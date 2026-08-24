# arithmetic-game

A mental-arithmetic speed sprint with a difficulty model that adapts to the
individual solver. Endless timed run; the rating is hidden while you play and
revealed on the end screen.

Target deployment: Cloudflare Pages (static, installable PWA).

## The difficulty model

Difficulty is **computed from the structure of a problem**, never from the
operand range it was drawn from. `47+38` and `47+31` occupy the same range and
differ by a carry, and the carry is most of the work.

`src/engine/cost.js` turns an item into a scalar cost from its carries,
borrows, digit counts, magnitude, ties, round operands and table-fact status.
Weights are priors from the mental-arithmetic literature; per-player deviation
from those priors is absorbed by the facet offsets in the player model.

## The player model

In a speed sprint, right/wrong is nearly uninformative -- a competent solver is
at ceiling on accuracy for most items. The difficulty signal lives in the clock.
So the primary fit is latency:

    log(RT_seconds) = intercept + offset[facet] + slope * cost
    P(correct)      = sigmoid((accThreshold - cost) / ACC_WIDTH)

Both are updated online after every item. The facet offsets are shrunk toward
zero, so a first-time player gets sensible difficulty within a few items while a
returning player gets true per-facet targeting across nine facets
(`add.retrieve/plain/carry`, `sub.*`, `mul.table/multi`, `div.exact`).

**A player's rating is the cost they can sustain at 2.5 seconds per item** --
expressed in the same units the generator consumes.

Two details that matter more than they look:

- A wrong answer is scored as "this item was ~0.45 log-units above your level",
  ignoring its observed RT. Error latencies are bimodal (mostly fast slips, some
  long struggles), so the timestamp of a miss is not trustworthy.
- Observations are weighted by distance from the player's rating. Items far
  outside the flow band are measured badly, so they teach the model less.

## Verified against an independent solver

`sim/human.js` is a synthetic solver parameterised in milliseconds from the
literature. It imports nothing from `src/engine` and deliberately includes
effects the cost model does not represent, so the engine cannot grade its own
homework.

    npm run sim

Results at the chosen configuration (120s sprint, -4s per miss, ramp -1.5..+2.5
with distance weighting), over a population of 250 synthetic solvers:

| metric | value |
| --- | --- |
| Spearman vs. ground-truth ability, after ONE run | 0.945 |
| mean absolute rating error | 0.52 (population sd 1.97) |
| run-to-run rating sd for a fixed player | 0.196 |
| items per run | ~38 |
| accuracy held | ~87% |

Findings that drove the configuration:

- **Sudden death is unusable.** 8.9 items per run, ranging 1 to 18; Spearman
  falls to 0.733 and accuracy sd is 26.7 points. Its low rating variance is an
  artifact of barely learning anything.
- **Three lives is nearly as noisy** -- runs of 7 to 27 items, and the worst
  run-to-run rating stability of the four policies tested.
- **A time penalty per miss wins**, and a larger penalty measures better: -5s
  beat -3s on both error and stability.
- **A difficulty ramp is informative, but only if you weight it.** Unweighted, a
  moderate ramp is worse than flat on every measure. Weighted by distance from
  the player's rating, it beats flat (MAE 0.52 vs 0.70) because the wider cost
  range identifies the slope of the latency line.
- **There is a ~0.85s latency floor** from encoding and typing, so items below
  roughly cost 1 are indistinguishable to the model. The ramp must not start
  down there.

One more guard came out of playing it rather than simulating it: `ratingCost`
reads a target latency off a fitted line, so a solver whose latency does *not*
vary with difficulty -- a calculator, a child mashing keys, a run that sampled a
narrow cost range -- drives the slope to its floor and the quotient toward
infinity. The rating is therefore bounded to the span the generator can actually
produce. The fit is left undistorted; only the extrapolation drawn from it is
clamped, and the simulation numbers above are unchanged by it.

## The app

A two-minute sprint. The rating is hidden while you play and revealed at the
end, so the run stays about the arithmetic.

- **Answers submit themselves** the moment you type the last digit. It removes a
  keypress worth roughly 15% of an easy item. The cost is that a typo commits:
  backspace only helps mid-answer.
- **Latency is timestamped from the input event**, not from a render callback,
  and the item's clock starts on the painted frame rather than the state update.
  The engine is a latency model, so sloppy instrumentation would quietly corrupt
  everything it learns.
- **Keys fire on `pointerdown`**, about 100ms earlier than `click`.
- A miss costs 4 seconds and shows it: the bar lurches, it does not announce.

Type is Libre Franklin, self-hosted (the app must render identically offline).
The chart mark is a separate token from the UI accent because it is validated
against the chart surface in both themes -- dark mode needs a darker step
(`#CE7E22`) than the interface accent to stay inside the legible lightness band.

    npm run dev        # local
    npm run build      # typecheck + bundle to dist/
    npm run verify     # play a full sprint in Chromium and screenshot every screen

## Deploying

Cloudflare Pages, build command `npm run build`, output directory `dist`. The
game makes no network calls at run time, so it is fully playable offline once
installed.

## Layout

    src/engine/cost.js       structural difficulty of an item
    src/engine/rating.js     online per-player latency + accuracy fit
    src/engine/generator.js  cost-targeted item generation per facet
    src/game/session.js      the sprint: ramp, facet choice, what a miss costs
    src/game/tiers.ts        named bands over the continuous rating
    src/ui/                  start, sprint and reveal screens
    sim/human.js             independent synthetic solver (ground truth)
    sim/simulate.js          evaluation harness (drives src/game/session.js)
    sim/exp*.js              the experiments behind the table above

The sprint logic lives in `src/game/session.js` and is imported by both the app
and the harness. If the simulator drove its own copy, the configuration
validated against 250 synthetic solvers would not be the one that ships.
