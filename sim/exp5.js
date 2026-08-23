import { runSprint, trueRating, spearman, mean, sd } from './simulate.js';
import { createProfile, ratingCost } from '../src/engine/rating.js';
import { makeHuman, mulberry32 } from './human.js';

const base = { missPolicy: 'time', missPenaltyS: 4, durationS: 120 };
const RAMPS = [['flat      ', 0, 0], ['mild      ', -1, 1.5], ['moderate  ', -1.5, 2.5], ['wide      ', -3, 5]];

console.log('=== 120s sprint, population of 250, one run each ===');
console.log('ramp         items  acc%  spearman   MAE    ratingSD(40 runs)');
for (const [name, rampLo, rampHi] of RAMPS) {
  const rng = mulberry32(9001);
  const truths = [], ests = [], items = [], accs = [];
  for (let i = 0; i < 250; i++) {
    const human = makeHuman(rng, { speed: 0.5 + 1.5 * rng(), errorProneness: 0.6 + 0.9 * rng(),
      facetSkill: { mul: 0.7 + 0.9 * rng(), div: 0.7 + 0.9 * rng() } });
    truths.push(trueRating(human, rng));
    const p = createProfile();
    const r = runSprint(p, human, rng, { ...base, rampLo, rampHi });
    items.push(r.items); ests.push(ratingCost(p)); accs.push(100 * r.solved / r.items);
  }
  const errs = ests.map((e, i) => e - truths[i]);
  const rng2 = mulberry32(4242);
  const h2 = makeHuman(rng2, { speed: 1.0 });
  const p2 = createProfile(); const rr = [];
  for (let run = 1; run <= 40; run++) { runSprint(p2, h2, rng2, { ...base, rampLo, rampHi }); if (run > 10) rr.push(ratingCost(p2)); }
  console.log(name, mean(items).toFixed(1).padStart(6), mean(accs).toFixed(0).padStart(5),
    spearman(truths, ests).toFixed(3).padStart(9), mean(errs.map(Math.abs)).toFixed(2).padStart(6),
    sd(rr).toFixed(3).padStart(14));
}

console.log('\n=== within-run shape: does a ramp actually create drama? ===');
console.log('(median player, 200 runs pooled, by fifth of the run)');
for (const [name, rampLo, rampHi] of [RAMPS[0], RAMPS[2]]) {
  const rng = mulberry32(31337);
  const human = makeHuman(rng, { speed: 1.0 });
  const p = createProfile();
  for (let w = 0; w < 5; w++) runSprint(p, human, rng, { ...base, rampLo, rampHi });
  const bins = Array.from({ length: 5 }, () => ({ rt: [], ok: [], cost: [] }));
  for (let run = 0; run < 200; run++) {
    const r = runSprint(p, human, rng, { ...base, rampLo, rampHi });
    r.log.forEach((l, i) => {
      const b = Math.min(4, Math.floor(5 * i / r.log.length));
      bins[b].rt.push(l.rtMs / 1000); bins[b].ok.push(l.correct ? 1 : 0); bins[b].cost.push(l.cost);
    });
  }
  console.log(`\n${name.trim()}:  fifth   cost   medRT   acc%`);
  bins.forEach((b, i) => {
    const rts = b.rt.slice().sort((x, y) => x - y);
    console.log(`            ${i + 1}     ${mean(b.cost).toFixed(2)}   ${rts[Math.floor(rts.length / 2)].toFixed(2)}   ${(100 * mean(b.ok)).toFixed(0)}`);
  });
}
