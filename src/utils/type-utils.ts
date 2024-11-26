
/**
 * Return if value !== undefined.
 */
export function isDefined<T>(val: T | undefined): val is T {
  return val !== undefined;
}

/**
 * Return if value !== null.
 */
export function isNotNull<T>(val: T | null): val is T {
  return val !== null;
}

/**
 * If defined and set
 * Return if value !== undefined && value !== null.
 */
export function isContent<T>(val: T | null | undefined): val is T {
  return isDefined(val) && isNotNull(val);
}

/**
 * If defined and set
 * Return if value === undefined || value === null.
 */
export function isNotContent<T>(val: T | null | undefined): val is T {
  return val === undefined || val === null;
}

/**
 * Return if value !== undefined && value !== null && value !== ''.
 */
export function isFilled(val: string | null | undefined): val is string {
  return isContent(val) && val !== '';
}

export function isStringNumber(val: string | null | undefined): val is string {
  return isContent(val) && val !== '';
}

export function isStringDecimal(val: string | null | undefined): val is string {
  return isStringNumber(val) && Number(val) % 1 != 0;
}
