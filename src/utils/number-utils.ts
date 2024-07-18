/**
 * Remove decimals with no round.
 */
export function cropDecimals(x: number, maxDecimals = 0): number {
  const s = String(x);
  const i = s.indexOf('.');
  if (i < 0) {
    return x;
  }
  const d = maxDecimals ? maxDecimals + 1 : 0;
  const result = Number(s.slice(0, i + d));
  return result;
}


export function toNumberList(v: string) {
  return v.split(',').map((i: string) => +i);
}