// The sprint itself: what to ask next, and what an answer costs.
//
// This module is shared verbatim by the app and by the evaluation harness in
// sim/. That is deliberate -- if the simulator drove its own copy of the ramp
// and facet-selection logic, the configuration validated against 250 synthetic
// solvers would not be the configuration that ships.
//
// It owns no timers. The caller supplies the measured latency of each answer,
// so the same code runs against a real player in real time and against a
// synthetic solver as fast as the CPU allows.

import { FACETS } from '../engine/cost.js';
import { generateItem } from '../engine/generator.js';
import { observe, ratingCost } from '../engine/rating.js';
import { mulberry32 } from './rng.js';

// Chosen by simulation; see README for the numbers behind each value.
export const SPRINT = {
  durationS: 120,      // 120s measures materially better than 60s (~38 items vs ~19)
  missPolicy: 'time',  // sudden-death and 3-lives were both far noisier
  missPenaltyS: 4,
  lives: 3,
  rampLo: -1.5,        // start below the player's rating: the opening should feel fast
  rampHi: 2.5,         // and end above it: the ramp is what ends the run
  flatFraction: 0,
  downWeight: true,    // off-band items are measured badly, so they teach less
};

// Reachable cost range per facet. `add.carry` cannot be made easier than about
// 2.6 no matter what target it is handed, so the low end of the ramp has to be
// served by choosing a different facet rather than an easier item.
const FACET_RANGE = (() => {
  const rng = mulberry32(99);
  const out = {};
  for (const facet of FACETS) {
    const costs = [];
    for (const targetCost of [1, 3, 5, 7, 9]) {
      for (let i = 0; i < 120; i++) costs.push(generateItem(rng, { targetCost, facet, pool: 20 }).cost);
    }
    costs.sort((a, b) => a - b);
    out[facet] = { lo: costs[Math.floor(costs.length * 0.03)], hi: costs[Math.floor(costs.length * 0.97)] };
  }
  return out;
})();

// Weakness (a large latency offset means slow means weak) plus an exploration
// bonus for under-sampled facets, penalised by how far the facet sits from the
// cost the ramp is currently asking for.
export function chooseFacet(profile, target, rng) {
  const weights = FACETS.map((f) => {
    const { lo, hi } = FACET_RANGE[f];
    const miss = Math.max(0, lo - target) + Math.max(0, target - hi);
    const weakness = (profile.offsets[f] ?? 0) * 2.0;
    const explore = 1.2 / Math.sqrt(1 + (profile.facetN[f] ?? 0));
    return Math.exp(weakness + explore - 1.4 * miss);
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < FACETS.length; i++) { r -= weights[i]; if (r <= 0) return FACETS[i]; }
  return FACETS[FACETS.length - 1];
}

const keyOf = (item) => `${item.op}${item.a}_${item.b}`;

export function createSession(profile, rng, opts = {}) {
  const cfg = { ...SPRINT, ...opts };
  const seen = new Set();
  const log = [];
  let elapsedS = 0, solved = 0, missed = 0, ended = false, pending = null;

  const progress = () => Math.min(1, elapsedS / cfg.durationS);
  const remainingS = () => Math.max(0, cfg.durationS - elapsedS);
  const isOver = () => ended || elapsedS >= cfg.durationS;

  // Where the ramp is pointing right now, in cost units.
  function currentTarget(rated) {
    const p = progress();
    const ramped = cfg.flatFraction > 0
      ? (p < cfg.flatFraction ? 0 : cfg.rampHi * (p - cfg.flatFraction) / (1 - cfg.flatFraction))
      : cfg.rampLo + (cfg.rampHi - cfg.rampLo) * p;
    return Math.max(0.6, rated + ramped);
  }

  function nextItem() {
    const rated = ratingCost(profile);
    const target = currentTarget(rated);
    const facet = chooseFacet(profile, target, rng);
    const item = generateItem(rng, { targetCost: target, facet, exclude: seen });
    seen.add(keyOf(item));
    pending = { item, rated, target };
    return item;
  }

  // `rtMs` is the caller's measured latency: wall-clock in the app, modelled in
  // the simulator. Everything downstream of here is identical either way.
  function submit({ correct, rtMs }) {
    if (!pending) throw new Error('submit() called before nextItem()');
    const { item, rated, target } = pending;
    pending = null;

    elapsedS += rtMs / 1000;
    let penaltyS = 0;
    if (correct) {
      solved++;
    } else {
      missed++;
      if (cfg.missPolicy === 'time') { penaltyS = cfg.missPenaltyS; elapsedS += penaltyS; }
      else if (cfg.missPolicy === 'sudden') ended = true;
      else if (cfg.missPolicy === 'lives' && missed >= cfg.lives) ended = true;
    }

    // Items far from the player's ability are measured badly -- their latency
    // is an extrapolation, and a miss carries imputed rather than observed
    // timing -- so they move the fit less.
    const weight = cfg.downWeight ? 1 / (1 + 0.55 * Math.abs(item.cost - rated)) : 1;
    observe(profile, item, { correct, rtMs, weight });

    log.push({ ...item, correct, rtMs, target, weight });
    return { penaltyS, solved, missed, over: isOver() };
  }

  return {
    cfg, nextItem, submit, isOver, progress, remainingS,
    get elapsedS() { return elapsedS; },
    get solved() { return solved; },
    get missed() { return missed; },
    get items() { return log.length; },
    get log() { return log; },
  };
}
