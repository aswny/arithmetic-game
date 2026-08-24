import { runSprint, trueRating, spearman, mean, sd } from './simulate.js';
import { createProfile, ratingCost } from '../src/engine/rating.js';
import { generateItem } from '../src/engine/generator.js';
import { FACETS } from '../src/engine/cost.js';
import { makeHuman, mulberry32 } from './human.js';

const base = { missPolicy: 'time', missPenaltyS: 4, durationS: 120 };
// Every row states downWeight explicitly: SPRINT defaults it to true, so a row
// that omitted it would silently be weighted and the comparison would collapse.
const CONFIGS = [
  ['flat, no weighting  ', { rampLo: 0, rampHi: 0, downWeight: false }],
  ['flat + weighting    ', { rampLo: 0, rampHi: 0, downWeight: true }],
  ['moderate ramp       ', { rampLo: -1.5, rampHi: 2.5, downWeight: false }],
  ['moderate + weighting', { rampLo: -1.5, rampHi: 2.5, downWeight: true }],
  ['hybrid 60/40        ', { flatFraction: 0.6, rampHi: 3.0, downWeight: false }],
  ['hybrid 60/40 + wgt  ', { flatFraction: 0.6, rampHi: 3.0, downWeight: true }],
];

console.log('=== 120s, population of 250 ===');
console.log('config                spearman   MAE   ratingSD   endAcc%  endRT');
for (const [name, opts] of CONFIGS) {
  const rng = mulberry32(9001);
  const truths = [], ests = [];
  for (let i = 0; i < 250; i++) {
    const human = makeHuman(rng, { speed: 0.5 + 1.5 * rng(), errorProneness: 0.6 + 0.9 * rng(),
      facetSkill: { mul: 0.7 + 0.9 * rng(), div: 0.7 + 0.9 * rng() } });
    truths.push(trueRating(human, rng));
    const p = createProfile();
    runSprint(p, human, rng, { ...base, ...opts });
    ests.push(ratingCost(p));
  }
  const errs = ests.map((e, i) => e - truths[i]);

  const rng2 = mulberry32(4242);
  const h2 = makeHuman(rng2, { speed: 1.0 });
  const p2 = createProfile(); const rr = []; const endAcc = [], endRT = [];
  for (let run = 1; run <= 40; run++) {
    const r = runSprint(p2, h2, rng2, { ...base, ...opts });
    if (run > 10) {
      rr.push(ratingCost(p2));
      const tail = r.log.slice(Math.floor(r.log.length * 0.8));
      endAcc.push(100 * mean(tail.map((l) => (l.correct ? 1 : 0))));
      endRT.push(mean(tail.map((l) => l.rtMs / 1000)));
    }
  }
  console.log(name, spearman(truths, ests).toFixed(3).padStart(9), mean(errs.map(Math.abs)).toFixed(2).padStart(6),
    sd(rr).toFixed(3).padStart(10), mean(endAcc).toFixed(0).padStart(9), mean(endRT).toFixed(2).padStart(7));
}

console.log('\n=== visual headroom: how different can items look at the SAME cost? ===');
const rng3 = mulberry32(5150);
for (const target of [3, 4.5, 6]) {
  const byFacet = [];
  for (const f of FACETS) {
    const cands = [];
    for (let i = 0; i < 300; i++) {
      const it = generateItem(rng3, { targetCost: target, facet: f, pool: 30 });
      if (Math.abs(it.cost - target) < 0.35) cands.push(it);
    }
    if (!cands.length) continue;
    const glyphs = cands.map((it) => String(it.a).length + String(it.b).length);
    byFacet.push({ f, glyphs: mean(glyphs), ex: cands[0] });
  }
  byFacet.sort((x, y) => x.glyphs - y.glyphs);
  const lo = byFacet[0], hi = byFacet[byFacet.length - 1];
  console.log(`cost ~${target}:  lightest ${lo.ex.a}${lo.ex.op}${lo.ex.b} (${lo.glyphs.toFixed(1)} digits)`
    + `   heaviest ${hi.ex.a}${hi.ex.op}${hi.ex.b} (${hi.glyphs.toFixed(1)} digits)`);
}
