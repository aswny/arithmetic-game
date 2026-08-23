import { runSprint, trueRating, mean, sd } from './simulate.js';
import { createProfile, ratingCost, TARGET_SECONDS } from '../src/engine/rating.js';
import { makeHuman, mulberry32 } from './human.js';

const rng = mulberry32(11);
const human = makeHuman(rng, { speed: 1.0 });
const truth = trueRating(human, rng);
console.log(`ground-truth rating (cost sustained at ${TARGET_SECONDS}s): ${truth.toFixed(2)}\n`);

const p = createProfile();
console.log('run  items  solved  missed   rating   err    medRT   acc%');
const perRun = [];
for (let run = 1; run <= 25; run++) {
  const r = runSprint(p, human, rng, { durationS: 60 });
  const rts = r.log.map((l) => l.rtMs / 1000).sort((a, b) => a - b);
  const acc = 100 * r.solved / r.items;
  const rt = ratingCost(p);
  perRun.push({ items: r.items, rating: rt, acc });
  if (run <= 8 || run % 5 === 0) {
    console.log(
      String(run).padStart(3), String(r.items).padStart(6), String(r.solved).padStart(7),
      String(r.missed).padStart(7), rt.toFixed(2).padStart(8),
      (rt - truth).toFixed(2).padStart(6), rts[Math.floor(rts.length / 2)].toFixed(2).padStart(7),
      acc.toFixed(0).padStart(6));
  }
}
const late = perRun.slice(10);
console.log(`\nitems/run: ${mean(perRun.map(r=>r.items)).toFixed(1)} +/- ${sd(perRun.map(r=>r.items)).toFixed(1)}`);
console.log(`rating (runs 11-25): mean ${mean(late.map(r=>r.rating)).toFixed(2)}  sd ${sd(late.map(r=>r.rating)).toFixed(3)}  bias ${(mean(late.map(r=>r.rating))-truth).toFixed(2)}`);
console.log(`accuracy (runs 11-25): ${mean(late.map(r=>r.acc)).toFixed(1)}%`);
