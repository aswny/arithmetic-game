// Structural difficulty model for mental-arithmetic items.
//
// An item's cost is computed from the *shape* of the problem, not from the
// range its operands were drawn from. 47+38 and 47+31 occupy the same operand
// range but differ by a carry, and the carry is most of the work.
//
// Units are arbitrary "difficulty units": ~0 is trivial (2+3), ~10 is punishing
// (87x46). Weights are priors taken from the mental-arithmetic literature
// (problem-size effect, carry/borrow effect, tie effect, table-fact retrieval).
// Per-player deviation from these priors is absorbed by the facet offsets in
// rating.js, so the priors only need to be approximately right.

export const digits = (n) => String(Math.abs(n)).length;

export function carryCount(a, b) {
  let carries = 0, carry = 0;
  while (a > 0 || b > 0) {
    carry = (a % 10) + (b % 10) + carry >= 10 ? 1 : 0;
    carries += carry;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return carries;
}

// Assumes a >= b. Cascading borrows (503 - 8) are counted individually.
export function borrowCount(a, b) {
  let borrows = 0, borrow = 0;
  while (b > 0 || borrow > 0) {
    borrow = (a % 10) - (b % 10) - borrow < 0 ? 1 : 0;
    borrows += borrow;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return borrows;
}

const digitList = (n) => {
  const out = [];
  while (n > 0) { out.push(n % 10); n = Math.floor(n / 10); }
  return out.length ? out : [0];
};

// Digit-pair products that spill into the next column.
function partialCarries(a, b) {
  let c = 0;
  for (const x of digitList(a)) for (const y of digitList(b)) if (x * y >= 10) c++;
  return c;
}

const isRound = (n) => n % 10 === 0;

export function facetOf(item) {
  const { op, a, b } = item;
  if (op === '+') {
    if (a < 10 && b < 10) return 'add.retrieve';
    return carryCount(a, b) > 0 ? 'add.carry' : 'add.plain';
  }
  if (op === '-') {
    if (a < 10 && b < 10) return 'sub.retrieve';
    return borrowCount(a, b) > 0 ? 'sub.borrow' : 'sub.plain';
  }
  if (op === '*') return a <= 10 && b <= 10 ? 'mul.table' : 'mul.multi';
  return 'div.exact';
}

export const FACETS = [
  'add.retrieve', 'add.plain', 'add.carry',
  'sub.retrieve', 'sub.plain', 'sub.borrow',
  'mul.table', 'mul.multi', 'div.exact',
];

export function costOf(item) {
  const { op, a, b } = item;
  const log10 = (n) => Math.log10(Math.max(n, 1));

  if (op === '+') {
    const sum = a + b;
    return 1.0 * (digits(a) - 1) + 1.0 * (digits(b) - 1)
      + 1.3 * carryCount(a, b)
      + 0.35 * log10(sum)
      - 0.6 * (a === b ? 1 : 0)
      - 0.7 * (isRound(a) || isRound(b) ? 1 : 0);
  }

  if (op === '-') {
    return 1.0 * (digits(a) - 1) + 1.0 * (digits(b) - 1)
      + 1.5 * borrowCount(a, b)
      + 0.35 * log10(a)
      - 0.7 * (isRound(a) || isRound(b) ? 1 : 0)
      + 0.3; // subtraction is uniformly slower than the matching addition
  }

  if (op === '*') {
    const product = a * b;
    if (a <= 10 && b <= 10) {
      return 0.8 + 0.5 * log10(product)
        - 0.5 * (a === b ? 1 : 0)
        - 0.9 * (a === 10 || b === 10 || a === 1 || b === 1 ? 1 : 0);
    }
    return 1.2
      + 1.6 * (digits(a) - 1) + 1.6 * (digits(b) - 1)
      + 0.9 * partialCarries(a, b)
      + 0.5 * log10(product)
      - 0.9 * (isRound(a) || isRound(b) ? 1 : 0);
  }

  // Exact division a / b = q, solved by recalling the matching product.
  return costOf({ op: '*', a: Math.round(a / b), b }) + 0.8;
}
