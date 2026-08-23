import { runSprint, trueRating, spearman, mean, sd } from './simulate.js';
import { createProfile, ratingCost } from '../src/engine/rating.js';
import { makeHuman, mulberry32 } from './human.js';

const rng = mulberry32(2024);
const N = 160;
const truths = [], est1 = [], est3 = [], est10 = [];

for (let i = 0; i < N; i++) {
  const speed = 0.5 + 1.5 * rng();
  const human = makeHuman(rng, {
    speed,
    errorProneness: 0.6 + 0.9 * rng(),
    facetSkill: { mul: 0.7 + 0.9 * rng(), sub: 0.8 + 0.5 * rng(), div: 0.7 + 0.9 * rng() },
  });
  truths.push(trueRating(human, rng));
  const p = createProfile();
  for (let run = 1; run <= 10; run++) {
    runSprint(p, human, rng, { durationS: 60 });
    if (run === 1) est1.push(ratingCost(p));
    if (run === 3) est3.push(ratingCost(p));
  }
  est10.push(ratingCost(p));
}

const report = (label, est) => {
  const errs = est.map((e, i) => e - truths[i]);
  console.log(
    label.padEnd(12),
    `spearman ${spearman(truths, est).toFixed(3)}`,
    ` bias ${mean(errs).toFixed(2)}`,
    ` MAE ${mean(errs.map(Math.abs)).toFixed(2)}`,
    ` sd(err) ${sd(errs).toFixed(2)}`);
};
console.log(`ground-truth spread: ${Math.min(...truths).toFixed(2)} .. ${Math.max(...truths).toFixed(2)} (sd ${sd(truths).toFixed(2)})\n`);
report('after 1 run', est1);
report('after 3 runs', est3);
report('after 10 runs', est10);
