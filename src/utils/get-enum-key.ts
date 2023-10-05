export function getEnumKey(e: any, value: any) {
  const valueIndex = Object.values(e).indexOf(value);
  const key = Object.keys(e)[valueIndex];
  return key;
}
