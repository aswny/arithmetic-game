// Evaluation harness. Drives the real engine (src/engine/*) against the
// independent synthetic solver (sim/human.js) and reports whether the model
// actually recovers ability, stays calibrated, and holds players in flow.

import { costOf, FACETS } from '../src/engine/cost.js';
import { generateItem } from '../src/engine/generator.js';
import {
  createProfile, observe, ratingCost, predictLogRT, predictCorrect, TARGET_SECONDS,
} from '../src/engine/rating.js';
import { makeHuman, mulberry32 } from './human.js';

// ---------- reachable cost range per facet, sampled once ----------
const FACET_RANGE = {};
{
  const rng = mulberry32(99);
  for (const f of FACETS) {
    const costs = [];
    for (const t of [1, 3, 5, 7, 9]) {
      for (let i = 0; i < 120; i++) costs.push(generateItem(rng, { targetCost: t, facet: f, pool: 20 }).cost);
    }
    costs.sort((a, b) => a - b);
    FACET_RANGE[f] = { lo: costs[Math.floor(costs.length * 0.03)], hi: costs[Math.floor(costs.length * 0.97)] };
  }
}

// Facets are chosen by weakness (large latency offset = slow = weak), with an
// exploration bonus for under-sampled facets, penalised by how far the facet
// sits from the cost the ramp is currently asking for.
function chooseFacet(profile, target, rng) {
  const weights = FACETS.map((f) => {
    const r = FACET_RANGE[f];
    const miss = Math.max(0, r.lo - target) + Math.max(0, target - r.hi);
    const weakness = (profile.offsets[f] ?? 0) * 2.0;
    const explore = 1.2 / Math.sqrt(1 + (profile.facetN[f] ?? 0));
    return Math.exp(weakness + explore - 1.4 * miss);
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < FACETS.length; i++) { r -= weights[i]; if (r <= 0) return FACETS[i]; }
  return FACETS[FACETS.length - 1];
}

export function runSprint(profile, human, rng, opts = {}) {
  const {
    durationS = 60, missPolicy = 'time', missPenaltyS = 3, lives = 3,
    rampLo = -1.5, rampHi = 2.5, urgency = 1.15,
    flatFraction = 0,      // portion of the run held at the player's rating
    downWeight = false,    // shrink the learning rate for off-band items
  } = opts;

  let clock = durationS, solved = 0, missed = 0;
  const seen = new Set(), log = [];

  while (clock > 0) {
    const progress = 1 - clock / durationS;
    const rated = ratingCost(profile);
    const ramped = flatFraction > 0
      ? (progress < flatFraction ? 0 : rampHi * (progress - flatFraction) / (1 - flatFraction))
      : rampLo + (rampHi - rampLo) * progress;
    const target = Math.max(0.6, rated + ramped);
    const facet = chooseFacet(profile, target, rng);
    const item = generateItem(rng, { targetCost: target, facet, exclude: seen });
    seen.add(`${item.op}${item.a}_${item.b}`);

    const predLog = predictLogRT(profile, item.cost, item.facet);
    const predAcc = predictCorrect(profile, item.cost);
    const res = human.answer(item, urgency);

    clock -= res.rtMs / 1000;
    if (res.correct) solved++;
    else {
      missed++;
      if (missPolicy === 'time') clock -= missPenaltyS;
      else if (missPolicy === 'sudden') clock = 0;
      else if (missPolicy === 'lives' && missed >= lives) clock = 0;
    }

    const weight = downWeight
      ? 1 / (1 + 0.55 * Math.abs(item.cost - rated))
      : 1;
    observe(profile, item, { ...res, weight });
    log.push({ cost: item.cost, facet: item.facet, target, predLog, predAcc, ...res });
  }
  return { solved, missed, items: log.length, log };
}

// ---------- ground truth: the cost this solver sustains at TARGET_SECONDS ----------
export function trueRating(human, rng, urgency = 1.15) {
  const medianAt = (c) => {
    const rts = [];
    for (let i = 0; i < 260; i++) {
      const f = FACETS[i % FACETS.length];
      const r = FACET_RANGE[f];
      if (c < r.lo - 0.8 || c > r.hi + 0.8) continue;
      const item = generateItem(rng, { targetCost: c, facet: f, pool: 24 });
      rts.push(human.answer(item, urgency).rtMs / 1000);
    }
    rts.sort((a, b) => a - b);
    return rts.length ? rts[Math.floor(rts.length / 2)] : 99;
  };
  let lo = 0.5, hi = 11;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (medianAt(mid) < TARGET_SECONDS) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- stats helpers ----------
export const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
export const sd = (xs) => Math.sqrt(mean(xs.map((x) => (x - mean(xs)) ** 2)));
export function spearman(xs, ys) {
  const rank = (v) => {
    const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    idx.forEach(([, i], k) => { r[i] = k; });
    return r;
  };
  const [rx, ry] = [rank(xs), rank(ys)];
  const [mx, my] = [mean(rx), mean(ry)];
  const num = rx.reduce((s, x, i) => s + (x - mx) * (ry[i] - my), 0);
  const den = Math.sqrt(rx.reduce((s, x) => s + (x - mx) ** 2, 0) * ry.reduce((s, y) => s + (y - my) ** 2, 0));
  return num / den;
}
