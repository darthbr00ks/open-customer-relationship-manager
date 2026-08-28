/**
 * Fixed-point decimal arithmetic for money and quantities.
 *
 * Money is stored as `numeric(18,4)` and carried as a string end to end, so the
 * arithmetic in between has to avoid binary floating point too: `0.1 + 0.2` is
 * not a rounding curiosity when it is a customer's invoice. Every value is
 * parsed into a `bigint` of ten-thousandths, combined there, and rendered back
 * to a decimal string.
 */

/** Digits kept after the decimal point — matches `numeric(18,4)`. */
export const SCALE = 4;
const FACTOR = 10n ** BigInt(SCALE);

/**
 * Anything that names a fixed-point number: a decimal string, a plain number,
 * a bigint of whole units, or a Prisma `Decimal` (recognised by `toFixed`, the
 * same test the API serializer uses).
 */
export type Decimalish = string | number | bigint | { toFixed(digits: number): string } | null | undefined;

/** Parse a decimal string into ten-thousandths, rounding half away from zero. */
export function toScaled(value: Decimalish): bigint {
  if (value == null || value === '') return 0n;
  if (typeof value === 'bigint') return value * FACTOR;

  const text = String(value).trim();
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match) {
    throw new Error(`Not a decimal number: ${text}`);
  }
  const [, sign, whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') {
    throw new Error(`Not a decimal number: ${text}`);
  }

  const kept = fraction.slice(0, SCALE).padEnd(SCALE, '0');
  let scaled = BigInt(whole || '0') * FACTOR + BigInt(kept || '0');
  // Round half away from zero on the first dropped digit.
  const dropped = fraction.slice(SCALE);
  if (dropped !== '' && Number(dropped[0]) >= 5) {
    scaled += 1n;
  }
  return sign === '-' ? -scaled : scaled;
}

/** Render ten-thousandths back to a decimal string, without trailing zeros. */
export function fromScaled(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / FACTOR;
  const fraction = (absolute % FACTOR).toString().padStart(SCALE, '0').replace(/0+$/, '');
  const text = fraction === '' ? whole.toString() : `${whole}.${fraction}`;
  return negative && text !== '0' ? `-${text}` : text;
}

/** Multiply two scaled values, rounding the product half away from zero. */
export function mulScaled(a: bigint, b: bigint): bigint {
  const product = a * b;
  const negative = product < 0n;
  const absolute = negative ? -product : product;
  const rounded = (absolute + FACTOR / 2n) / FACTOR;
  return negative ? -rounded : rounded;
}

/** Divide two scaled values, rounding the quotient half away from zero. */
export function divScaled(a: bigint, b: bigint): bigint {
  if (b === 0n) throw new Error('Division by zero');
  const numerator = a * FACTOR;
  const negative = numerator < 0n !== b < 0n;
  const absNumerator = numerator < 0n ? -numerator : numerator;
  const absDenominator = b < 0n ? -b : b;
  const rounded = (absNumerator + absDenominator / 2n) / absDenominator;
  return negative ? -rounded : rounded;
}

export const maxScaled = (a: bigint, b: bigint) => (a > b ? a : b);
export const minScaled = (a: bigint, b: bigint) => (a < b ? a : b);

/** Convenience: decimal string in, decimal string out. */
export const multiply = (a: Decimalish, b: Decimalish) => fromScaled(mulScaled(toScaled(a), toScaled(b)));
export const add = (a: Decimalish, b: Decimalish) => fromScaled(toScaled(a) + toScaled(b));
export const subtract = (a: Decimalish, b: Decimalish) => fromScaled(toScaled(a) - toScaled(b));

/** Sum a column of decimal strings without leaving fixed point. */
export const sum = (values: Decimalish[]) => fromScaled(values.reduce<bigint>((total, v) => total + toScaled(v), 0n));
