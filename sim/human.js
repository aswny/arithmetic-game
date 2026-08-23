// Synthetic solver used as GROUND TRUTH for evaluating the engine.
//
// Deliberately imports nothing from src/engine. It is parameterised in
// milliseconds from the mental-arithmetic literature (problem-size effect,
// carry/borrow cost, tie advantage, table-fact retrieval, typing floor) and
// includes structure the engine's cost model does NOT represent -- so a good
// score here means the engine generalised, not that it graded its own homework.

export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const nDigits = (n) => String(Math.abs(n)).length;
const log2 = (n) => Math.log2(Math.max(n, 2));

function carries(a, b) {
  let c = 0, carry = 0;
  while (a > 0 || b > 0) {
    carry = (a % 10) + (b % 10) + carry >= 10 ? 1 : 0;
    c += carry;
    a = Math.floor(a / 10); b = Math.floor(b / 10);
  }
  return c;
}

function borrows(a, b) {
  let c = 0, borrow = 0;
  while (b > 0 || borrow > 0) {
    borrow = (a % 10) - (b % 10) - borrow < 0 ? 1 : 0;
    c += borrow;
    a = Math.floor(a / 10); b = Math.floor(b / 10);
  }
  return c;
}

function partials(a, b) {
  let n = 0, hard = 0;
  for (const x of String(a)) for (const y of String(b)) { n++; if (+x * +y >= 10) hard++; }
  return { n, hard };
}

const ENCODE_MS = 280;
const TYPE_MS_PER_DIGIT = 130;

// Nominal solve time for an unhurried median adult, excluding encode + typing.
function solveMs(item) {
  const { op, a, b } = item;

  if (op === '+') {
    if (a < 10 && b < 10) {
      return 330 + 55 * log2(a + b) + (a + b > 10 ? 150 : 0)
        - (a === b ? 110 : 0) - (a === 1 || b === 1 ? 160 : 0);
    }
    return 520 + 250 * (nDigits(a) - 1 + nDigits(b) - 1)
      + 420 * carries(a, b) + 70 * log2(a + b)
      - (a % 10 === 0 || b % 10 === 0 ? 200 : 0);
  }

  if (op === '-') {
    if (a < 10 && b < 10) return 380 + 60 * log2(a) - (a === b ? 120 : 0);
    return 1.15 * (520 + 250 * (nDigits(a) - 1 + nDigits(b) - 1)
      + 450 * borrows(a, b) + 70 * log2(a)
      - (a % 10 === 0 || b % 10 === 0 ? 200 : 0));
  }

  if (op === '*') {
    if (a <= 10 && b <= 10) {
      return 480 + 45 * log2(a * b) + (a > 5 && b > 5 ? 120 : 0)
        - (a === b ? 150 : 0) - (a === 1 || b === 1 || a === 10 || b === 10 ? 250 : 0);
    }
    const p = partials(a, b);
    return 900 + 480 * (p.n - 1) + 350 * p.hard + 60 * log2(a * b)
      - (a % 10 === 0 || b % 10 === 0 ? 400 : 0);
  }

  // Division is solved by recognizing the divisor and reading off (or
  // deriving) the quotient it implies -- NOT by working the full forward
  // multiplication back to front. A single-digit divisor, or one close to a
  // multiple of ten, stays a quick recognition step no matter how large the
  // dividend gets: dividing by 10 doesn't get four times slower just because
  // the dividend crossed 100. (This used to reuse solveMs('*', q, b)
  // wholesale, which inherits multiplication's own table-vs-multi-digit
  // strategy switch -- appropriate when multiplying two genuinely unknown
  // factors, wrong here, where the divisor is known and often trivial. Kept
  // as its own formula, not a call into solveMs, so this file stays an
  // independent read on the same real-world shortcut cost.js now models --
  // not cost.js's fix copied over.)
  const q = Math.round(a / b);
  const distToRound = Math.min(b % 10, 10 - (b % 10));
  const divisorFamiliarity = b <= 10 ? 1 : Math.max(0, 1 - distToRound / 5);
  return 260 // recognizing this as a backward-multiplication step
    + 210 * (nDigits(q) - 1)
    + 480 * (nDigits(b) - 1) * (1 - divisorFamiliarity)
    + 60 * log2(a)
    - 260 * divisorFamiliarity
    - 130 * (q === b ? 1 : 0);
}

// Probability of a wrong answer, independent of the timing model above.
function errorRate(item) {
  const { op, a, b } = item;
  let p = 0.008;
  if (op === '+') p += 0.045 * carries(a, b) + 0.022 * (nDigits(a) - 1 + nDigits(b) - 1);
  else if (op === '-') p += 0.060 * borrows(a, b) + 0.028 * (nDigits(a) - 1 + nDigits(b) - 1);
  else if (op === '*') {
    const p2 = partials(a, b);
    p += 0.030 * (p2.n - 1) + 0.035 * p2.hard + (a <= 10 && b <= 10 ? 0.010 : 0.02);
  } else p += 0.05;
  return p;
}

const FACET_GROUPS = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div' };

export function makeHuman(rng, opts = {}) {
  const {
    speed = 1.0,          // <1 faster than the median adult, >1 slower
    errorProneness = 1.0,
    noiseSigma = 0.22,    // lognormal RT noise; ~22% CV matches human data
    facetSkill = {},      // per-operation multipliers, e.g. { mul: 1.4 }
  } = opts;

  const answer = (item, urgency = 1.0) => {
    const group = FACET_GROUPS[item.op];
    const nominal = solveMs(item) * speed * (facetSkill[group] ?? 1.0);

    // Rushing buys speed and pays for it in accuracy.
    const rushed = nominal / urgency;
    let p = errorRate(item) * errorProneness * Math.pow(urgency, 2.2);

    // Beyond the solver's comfortable range, accuracy degrades sharply.
    p += Math.max(0, (rushed - 4000) / 4000) * 0.10;
    p = Math.min(p, 0.85);

    const correct = rng() >= p;
    const floor = ENCODE_MS + TYPE_MS_PER_DIGIT * String(item.answer).length;

    // Gaussian via Box-Muller, exponentiated for lognormal RT noise.
    const u1 = Math.max(rng(), 1e-9), u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    let rt = (floor + rushed) * Math.exp(noiseSigma * z);

    // Errors are bimodal: mostly fast slips, sometimes long struggles.
    // A naive "wrong means slow" assumption is wrong more often than not.
    if (!correct) rt *= rng() < 0.6 ? 0.55 : 1.9;

    return { correct, rtMs: Math.max(rt, floor * 0.8) };
  };

  return { answer, opts: { speed, errorProneness, facetSkill } };
}
