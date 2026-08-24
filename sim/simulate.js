// Evaluation harness. Drives the real game session (src/game/session.js) and
// the real engine (src/engine/*) against the independent synthetic solver in
// human.js, and reports whether the model recovers ability, stays calibrated,
// and holds players in flow.
//
// The sprint logic lives in src/game/session.js, not here, so what these
// experiments measure is exactly what the app runs.

import { FACETS } from '../src/engine/cost.js';
import { generateItem } from '../src/engine/generator.js';
import { ratingCost, TARGET_SECONDS } from '../src/engine/rating.js';
import { createSession } from '../src/game/session.js';
import { mulberry32 } from '../src/game/rng.js';

export function runSprint(profile, human, rng, opts = {}) {
  const { urgency = 1.15, ...cfg } = opts;
  const session = createSession(profile, rng, cfg);
  const log = [];
  while (!session.isOver()) {
    const item = session.nextItem();
    const res = human.answer(item, urgency);
    session.submit(res);
    log.push({ cost: item.cost, facet: item.facet, ...res });
  }
  return { solved: session.solved, missed: session.missed, items: session.items, log };
}

// ---------- ground truth: the cost this solver sustains at TARGET_SECONDS ----------
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
export { ratingCost };
