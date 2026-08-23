// Does the engine find a player's weak facet and spend its items there?
import { runSprint, mean } from './simulate.js';
import { createProfile, ratingCost } from '../src/engine/rating.js';
import { FACETS } from '../src/engine/cost.js';
import { makeHuman, mulberry32 } from './human.js';

const base = { missPolicy: 'time', missPenaltyS: 4, durationS: 120, rampLo: -1.5, rampHi: 2.5, downWeight: true };

for (const [label, facetSkill] of [
  ['balanced solver          ', {}],
  ['weak at multiplication   ', { mul: 1.9, div: 1.7 }],
  ['weak at subtraction      ', { sub: 1.9 }],
]) {
  const rng = mulberry32(60613);
  const human = makeHuman(rng, { speed: 1.0, facetSkill });
  const p = createProfile();
  let counts = {};
  for (let run = 1; run <= 12; run++) {
    const r = runSprint(p, human, rng, base);
    if (run > 6) for (const l of r.log) counts[l.facet] = (counts[l.facet] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((s, x) => s + x, 0);
  const rows = FACETS.map((f) => ({
    f,
    share: 100 * (counts[f] ?? 0) / total,
    rating: ratingCost(p, f),
  })).sort((a, b) => a.rating - b.rating);
  console.log(`\n${label} overall rating ${ratingCost(p).toFixed(2)}`);
  console.log('  weakest facets first:  facet          rating   item share');
  for (const r of rows.slice(0, 4)) {
    console.log(`                         ${r.f.padEnd(14)} ${r.rating.toFixed(2).padStart(6)} ${(r.share.toFixed(1) + '%').padStart(11)}`);
  }
  const strongest = rows[rows.length - 1];
  console.log(`  strongest:             ${strongest.f.padEnd(14)} ${strongest.rating.toFixed(2).padStart(6)} ${(strongest.share.toFixed(1) + '%').padStart(11)}`);
}
