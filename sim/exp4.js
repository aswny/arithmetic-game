import { runSprint, trueRating, spearman, mean, sd } from './simulate.js';
import { createProfile, ratingCost } from '../src/engine/rating.js';
import { makeHuman, mulberry32 } from './human.js';

const base = { missPolicy: 'time', missPenaltyS: 4 };

console.log('=== sprint duration (population of 90, one run each) ===');
console.log('secs   items   spearman   MAE    bias');
for (const durationS of [45, 60, 90, 120, 180]) {
  const rng = mulberry32(313);
  const truths = [], ests = [], items = [];
  for (let i = 0; i < 90; i++) {
    const human = makeHuman(rng, { speed: 0.5 + 1.5 * rng(), errorProneness: 0.6 + 0.9 * rng(),
      facetSkill: { mul: 0.7 + 0.9 * rng(), div: 0.7 + 0.9 * rng() } });
    truths.push(trueRating(human, rng));
    const p = createProfile();
    const r = runSprint(p, human, rng, { durationS, ...base });
    items.push(r.items); ests.push(ratingCost(p));
  }
  const errs = ests.map((e, i) => e - truths[i]);
  console.log(String(durationS).padStart(4), mean(items).toFixed(1).padStart(7),
    spearman(truths, ests).toFixed(3).padStart(10), mean(errs.map(Math.abs)).toFixed(2).padStart(6),
    mean(errs).toFixed(2).padStart(7));
}

console.log('\n=== ramp shape at 90s (lo/hi are offsets from the player rating) ===');
console.log(' lo   hi   items  acc%   medRT  spearman  MAE   ratingSD');
for (const [rampLo, rampHi] of [[0, 0], [-1, 1], [-1.5, 2.5], [-2, 3.5], [-3, 5]]) {
  const rng = mulberry32(414);
  const truths = [], ests = [], items = [], accs = [], rts = [];
  for (let i = 0; i < 90; i++) {
    const human = makeHuman(rng, { speed: 0.5 + 1.5 * rng(), errorProneness: 0.6 + 0.9 * rng(),
      facetSkill: { mul: 0.7 + 0.9 * rng(), div: 0.7 + 0.9 * rng() } });
    truths.push(trueRating(human, rng));
    const p = createProfile();
    const r = runSprint(p, human, rng, { durationS: 90, ...base, rampLo, rampHi });
    items.push(r.items); ests.push(ratingCost(p));
    accs.push(100 * r.solved / r.items);
    rts.push(mean(r.log.map((l) => l.rtMs / 1000)));
  }
  const errs = ests.map((e, i) => e - truths[i]);
  // stability for a single fixed player under this ramp
  const rng2 = mulberry32(818);
  const h2 = makeHuman(rng2, { speed: 1.0 });
  const p2 = createProfile();
  const rr = [];
  for (let run = 1; run <= 25; run++) { runSprint(p2, h2, rng2, { durationS: 90, ...base, rampLo, rampHi }); if (run > 8) rr.push(ratingCost(p2)); }
  console.log(String(rampLo).padStart(4), String(rampHi).padStart(4), mean(items).toFixed(1).padStart(7),
    mean(accs).toFixed(0).padStart(5), mean(rts).toFixed(2).padStart(7),
    spearman(truths, ests).toFixed(3).padStart(9), mean(errs.map(Math.abs)).toFixed(2).padStart(6),
    sd(rr).toFixed(3).padStart(9));
}
