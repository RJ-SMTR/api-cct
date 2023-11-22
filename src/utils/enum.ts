export class Enum {
  public static getKey<T>(e: T, value: any): string {
    const valueIndex = Object.values(e as any).indexOf(value);
    const key = Object.keys(e as any)[valueIndex];
    return key;
  }

  public static getKeys<T>(e: T): (keyof T)[] {
    const enumType = e;
    return Object.keys(enumType as any).filter(
      (key) => typeof enumType[key] === 'number',
    ) as (keyof T)[];
  }

  public static getValues<T>(enumType: T): T[keyof T][] {
    return this.getKeys(enumType).map((key) => enumType[key]);
  }
}
