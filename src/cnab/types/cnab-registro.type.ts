import { CnabField, isCnabField } from './cnab-field.type';

export type CnabRegistro = Record<string, CnabField>;

/**
 * It will check only first 2 items to save performance
 */
export function isCnabRegistro(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value)
      .slice(0, 2)
      .every((item) => isCnabField(item))
  );
}
