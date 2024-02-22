import { isArrayContainEqual } from 'src/utils/array-utils';
import {
  CnabRegistroMapped,
  isCnabRegistroMapped,
} from './cnab-registro-mapped.type';
import { CnabLoteMapped } from './cnab-lote-mapped.type';

export type CnabFileMapped = {
  headerArquivo: CnabRegistroMapped;
  lotes: CnabLoteMapped[];
  trailerArquivo: CnabRegistroMapped;
};

export function isCnabFileMapped(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isArrayContainEqual(Object.keys(value), [
      'headerArquivo',
      'lotes',
      'trailerArquivo',
    ]) &&
    isCnabRegistroMapped(value.headerArquivo)
  );
}
