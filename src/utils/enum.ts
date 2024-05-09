
/**
 * Get value or use default key, otherwise throw error
 * 
 * @param args.defaulValue Instead of throw error, return this value
 */
export function getEnumValue<T>(e: T, key: any, args?: { defaultKey?: keyof T, defaultValue: any }): any {
  const keyIndex = Object.keys(e as any).indexOf(key);
  const _args = args ? args : {
    defaultKey: undefined,
    defaultValue: null,
  };
  const valueIndexDefault = Object.values(e as any).indexOf(_args.defaultKey);
  if (keyIndex === -1 && valueIndexDefault === -1) {
    if (_args.defaultValue) {
      return _args.defaultValue;
    }
    throw new Error(`Value '${key}' does not exist in Enum ${e}.`);
  }
  if (keyIndex >= 0) {
    return e[key];
  } else {
    return e[valueIndexDefault];
  }
}

export function getEnumKey<T>(e: T, value: any): string {
  const valueIndex = Object.values(e as any).indexOf(value);
  if (valueIndex === -1) {
    throw new Error(`Value '${value}' does not exist in Enum ${e}.`);
  }
  const key = Object.keys(e as any)[valueIndex];
  return key;
}

export function findEnumKey<T>(e: T, value: any): string | undefined {
  const valueIndex = Object.values(e as any).indexOf(value);
  const key: string | undefined = Object.keys(e as any)[valueIndex];
  return key;
}

export function getEnumItems<T>(enumType: T): { key: keyof T; value: T[keyof T] }[] {
  const keys = getEnumKeys(enumType);
  const values = getEnumValues(enumType);
  return keys.map((key, index) => ({ key, value: values[index] }));
}

export function getEnumKeys<T>(e: T): (keyof T)[] {
  const enumType = e;
  return Object.keys(enumType as any).filter(
    (key) => typeof enumType[key] === 'number',
  ) as (keyof T)[];
}

export function getEnumValues<T>(enumType: T): T[keyof T][] {
  return getEnumKeys(enumType).map((key) => enumType[key]);
}

export const Enum = {
  findKey: findEnumKey,
  getKey: getEnumKey,
  getKeys: getEnumKeys,
  getValue: getEnumValue,
  getValues: getEnumValues,
  getItems: getEnumItems,
};
