// Item generation targeting a requested cost within a requested facet.
//
// Rejection sampling: draw a pool of structurally-valid candidates for the
// facet, keep whichever lands closest to the target cost. This keeps the
// generator honest -- difficulty is always measured by cost.js, never assumed
// from the operand range the candidate was drawn from.

import { costOf, facetOf, carryCount, borrowCount } from './cost.js';

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const magnitudeFor = (target) => (target < 3 ? 99 : target < 6 ? 199 : 999);

function draw(rng, facet, target) {
  const M = magnitudeFor(target);
  let a, b;
  switch (facet) {
    case 'add.retrieve':
      a = randInt(rng, 2, 9); b = randInt(rng, 2, 9);
      return { op: '+', a, b, answer: a + b };
    case 'add.plain':
    case 'add.carry': {
      a = randInt(rng, 10, M); b = randInt(rng, 2, M);
      const want = facet === 'add.carry';
      if ((carryCount(a, b) > 0) !== want) return null;
      return { op: '+', a, b, answer: a + b };
    }
    case 'sub.retrieve':
      a = randInt(rng, 3, 9); b = randInt(rng, 1, a - 1);
      return { op: '-', a, b, answer: a - b };
    case 'sub.plain':
    case 'sub.borrow': {
      a = randInt(rng, 12, M); b = randInt(rng, 2, a - 1);
      const want = facet === 'sub.borrow';
      if ((borrowCount(a, b) > 0) !== want) return null;
      return { op: '-', a, b, answer: a - b };
    }
    case 'mul.table':
      a = randInt(rng, 2, 10); b = randInt(rng, 2, 10);
      return { op: '*', a, b, answer: a * b };
    case 'mul.multi':
      a = randInt(rng, 11, target < 6 ? 99 : 199);
      b = randInt(rng, 2, target < 5 ? 9 : 99);
      return { op: '*', a, b, answer: a * b };
    default: {
      const q = randInt(rng, 2, target < 4 ? 12 : 99);
      b = randInt(rng, 2, target < 4 ? 9 : 19);
      return { op: '/', a: q * b, b, answer: q };
    }
  }
}

export function generateItem(rng, { targetCost, facet, exclude = null, pool = 80 }) {
  let best = null, bestErr = Infinity;
  for (let i = 0; i < pool; i++) {
    const cand = draw(rng, facet, targetCost);
    if (!cand) continue;
    if (exclude?.has(`${cand.op}${cand.a}_${cand.b}`)) continue;
    const err = Math.abs(costOf(cand) - targetCost);
    if (err < bestErr) { bestErr = err; best = cand; }
  }
  if (!best) best = draw(rng, 'add.carry', targetCost) ?? { op: '+', a: 12, b: 9, answer: 21 };
  best.cost = costOf(best);
  best.facet = facetOf(best);
  return best;
}
