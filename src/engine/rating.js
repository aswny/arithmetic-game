// Online player model.
//
// Two fitted surfaces, both updated after every item:
//
//   latency:  log(RT_seconds) = intercept + offset[facet] + slope * cost
//   accuracy: P(correct)      = sigmoid((accThreshold - cost) / ACC_WIDTH)
//
// Latency is the primary signal. In a speed sprint a competent solver is at
// ceiling on accuracy for most items, so right/wrong carries little
// information -- the difficulty signal lives in the clock.
//
// The player's rating is the cost they can sustain at TARGET_SECONDS per item,
// expressed in the same units the generator consumes.

import { costOf, facetOf } from './cost.js';

export const TARGET_SECONDS = 2.5;

const COST_CENTER = 3.0;    // centred so intercept and slope decouple
const ACC_WIDTH = 1.6;

// Bounds on the rating extrapolation -- roughly the span the generator covers.
export const RATING_MIN = 0.5;
export const RATING_MAX = 11.0;

const LR0 = 0.30, LR_TAU = 40, LR_MIN = 0.025;
const SLOPE_GAIN = 0.08;
const FACET_GAIN = 0.55, FACET_SHRINK = 0.06;
const ACC_GAIN = 0.35;

// A wrong answer is scored as "this item was ERROR_IMPUTE above your level",
// ignoring its observed RT. Error latencies are bimodal -- most are fast slips,
// some are long struggles -- so the timestamp of a miss is not trustworthy.
const ERROR_IMPUTE = 0.45;
const RESID_CLIP = 0.9;     // Huber-style clip; one distraction shouldn't move the fit

const sigmoid = (x) => 1 / (1 + Math.exp(-x));

export function createProfile() {
  return {
    intercept: Math.log(0.95),  // log-seconds at cost 0, near the typing floor
    slope: 0.20,
    accThreshold: 5.0,
    offsets: {},
    n: 0,
    facetN: {},
  };
}

export const predictLogRT = (profile, cost, facet) =>
  profile.intercept + (profile.offsets[facet] ?? 0) + profile.slope * cost;

export const predictRT = (profile, cost, facet) =>
  Math.exp(predictLogRT(profile, cost, facet));

export const predictCorrect = (profile, cost) =>
  sigmoid((profile.accThreshold - cost) / ACC_WIDTH);

// The rating: cost sustainable at TARGET_SECONDS. Per-facet when asked.
//
// This reads a target latency off a fitted line, so it is an extrapolation, and
// a near-flat line extrapolates to nonsense: a solver whose latency does not
// vary with cost -- someone using a calculator, a child mashing keys, or a run
// that happened to sample a narrow cost range -- drives `slope` to its floor
// and the quotient to infinity. RATING_MIN/MAX bound the answer to costs the
// generator can actually produce. The fit itself is left undistorted; only the
// extrapolation drawn from it is bounded.
export function ratingCost(profile, facet = null) {
  const off = facet ? (profile.offsets[facet] ?? 0) : 0;
  const slope = Math.max(profile.slope, 0.05);
  const rating = (Math.log(TARGET_SECONDS) - profile.intercept - off) / slope;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, rating));
}

// Cost at which the player is predicted to be `p` accurate.
export const costForAccuracy = (profile, p) =>
  profile.accThreshold - ACC_WIDTH * Math.log(p / (1 - p));

// `weight` scales the learning rate for this observation. Items far from the
// player's ability are measured badly -- their latency is an extrapolation and
// their errors carry imputed rather than observed timing -- so a caller that
// deliberately pushes past the flow band should down-weight what it learns there.
export function observe(profile, item, { correct, rtMs, weight = 1 }) {
  const cost = costOf(item);
  const facet = facetOf(item);
  const off = profile.offsets[facet] ?? 0;
  const pred = profile.intercept + off + profile.slope * cost;

  const obs = correct ? Math.log(rtMs / 1000) : pred + ERROR_IMPUTE;
  const resid = Math.max(-RESID_CLIP, Math.min(RESID_CLIP, obs - pred));

  const lr = weight * Math.max(LR_MIN, LR0 / (1 + profile.n / LR_TAU));

  profile.intercept += lr * resid;
  profile.slope = Math.max(0.05,
    profile.slope + lr * SLOPE_GAIN * resid * (cost - COST_CENTER));
  profile.offsets[facet] = (off + lr * FACET_GAIN * resid) * (1 - lr * FACET_SHRINK);

  const pHat = sigmoid((profile.accThreshold - cost) / ACC_WIDTH);
  profile.accThreshold -= lr * ACC_GAIN * ((correct ? 1 : 0) - pHat) * ACC_WIDTH;

  profile.n++;
  profile.facetN[facet] = (profile.facetN[facet] ?? 0) + 1;
  return { cost, facet, resid };
}
