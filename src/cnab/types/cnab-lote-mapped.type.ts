import { isArrayContainEqual } from 'src/utils/array-utils';
import {
  CnabRegistroMapped,
  isCnabRegistroMapped,
} from './cnab-registro-mapped.type';

export type CnabLoteMapped = {
  headerLote: CnabRegistroMapped;
  registros: CnabRegistroMapped[];
  trailerLote: CnabRegistroMapped;
};

export function isCnabLoteMapped(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isArrayContainEqual(Object.keys(value), [
      'headerLote',
      'registros',
      'trailerLote',
    ]) &&
    isCnabRegistroMapped(value.headerLote)
  );
}
