/**
 * @throws exception if value not exists in enum and there is no defaultValue
 */
function getValue<T>(e: T, value: any, defaultValue?: keyof T): any {
  const valueIndex = Object.values(e as any).indexOf(value);
  const valueIndexDefault = Object.values(e as any).indexOf(defaultValue);
  if (valueIndex === -1 || valueIndexDefault === -1) {
    throw new Error(`Value '${value}' does not exist in Enum ${e}.`);
  }
  return e[valueIndex] || e[valueIndexDefault];
}

function getKey<T>(e: T, value: any): string {
  const valueIndex = Object.values(e as any).indexOf(value);
  if (valueIndex === -1) {
    throw new Error(`Value '${value}' does not exist in Enum ${e}.`);
  }
  const key = Object.keys(e as any)[valueIndex];
  return key;
}

function findKey<T>(e: T, value: any): string | undefined {
  const valueIndex = Object.values(e as any).indexOf(value);
  const key: string | undefined = Object.keys(e as any)[valueIndex];
  return key;
}

function getKeys<T>(e: T): (keyof T)[] {
  const enumType = e;
  return Object.keys(enumType as any).filter(
    (key) => typeof enumType[key] === 'number',
  ) as (keyof T)[];
}

function getValues<T>(enumType: T): T[keyof T][] {
  return this.getKeys(enumType).map((key) => enumType[key]);
}

export const Enum = {
  findKey: findKey,
  getKey: getKey,
  getKeys: getKeys,
  getValues: getValues,
  getValue: getValue,
};
