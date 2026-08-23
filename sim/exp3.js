import { runSprint, trueRating, spearman, mean, sd } from './simulate.js';
import { createProfile, ratingCost } from '../src/engine/rating.js';
import { makeHuman, mulberry32 } from './human.js';

const POLICIES = [
  ['time -3s', { missPolicy: 'time', missPenaltyS: 3 }],
  ['time -5s', { missPolicy: 'time', missPenaltyS: 5 }],
  ['3 lives ', { missPolicy: 'lives', lives: 3 }],
  ['sudden  ', { missPolicy: 'sudden' }],
];

console.log('=== information per run (population of 90, one 60s run each) ===');
console.log('policy      items/run   sd    spearman  MAE');
for (const [name, opts] of POLICIES) {
  const rng = mulberry32(555);
  const truths = [], ests = [], items = [];
  for (let i = 0; i < 90; i++) {
    const human = makeHuman(rng, {
      speed: 0.5 + 1.5 * rng(), errorProneness: 0.6 + 0.9 * rng(),
      facetSkill: { mul: 0.7 + 0.9 * rng(), div: 0.7 + 0.9 * rng() },
    });
    truths.push(trueRating(human, rng));
    const p = createProfile();
    const r = runSprint(p, human, rng, { durationS: 60, ...opts });
    items.push(r.items); ests.push(ratingCost(p));
  }
  const errs = ests.map((e, i) => e - truths[i]);
  console.log(name, String(mean(items).toFixed(1)).padStart(9), sd(items).toFixed(1).padStart(6),
    spearman(truths, ests).toFixed(3).padStart(10), mean(errs.map(Math.abs)).toFixed(2).padStart(6));
}

console.log('\n=== run-to-run stability (one median player, 30 runs) ===');
console.log('policy      items/run  minmax   rating sd   acc%   acc sd');
for (const [name, opts] of POLICIES) {
  const rng = mulberry32(777);
  const human = makeHuman(rng, { speed: 1.0 });
  const p = createProfile();
  const items = [], ratings = [], accs = [];
  for (let run = 1; run <= 30; run++) {
    const r = runSprint(p, human, rng, { durationS: 60, ...opts });
    if (run > 8) { items.push(r.items); ratings.push(ratingCost(p)); accs.push(100 * r.solved / r.items); }
  }
  console.log(name, String(mean(items).toFixed(1)).padStart(9),
    `${Math.min(...items)}-${Math.max(...items)}`.padStart(8),
    sd(ratings).toFixed(3).padStart(11), mean(accs).toFixed(0).padStart(6), sd(accs).toFixed(1).padStart(8));
}
