/**
 * Return if value !== undefined.
 */
export function isDefined<T>(val: T | undefined): val is T {
  return val !== undefined;
}

/**
 * Return if value !== null.
 */
export function isContent<T>(val: T | null): val is T {
  return val !== null;
}

/**
 * If defined and set
 * Return if value !== undefined && value !== null.
 */
export function isDefinedContent<T>(val: T | null | undefined): val is T {
  return isDefined(val) && isContent(val);
}

/**
 * Return if value !== undefined && value !== null && value !== ''.
 */
export function isFilled(val: string | null | undefined): val is string {
  return isDefinedContent(val) && val !== '';
}