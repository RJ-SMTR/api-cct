import { isArrayContainEqual } from 'src/utils/array-utils';
import { CnabLote } from './cnab-lote.type';
import { CnabRegistro } from './cnab-registro.type';

export type CnabFile = {
  headerArquivo: CnabRegistro;
  lotes: CnabLote[];
  trailerArquivo: CnabRegistro;
};

export function isCnabFile(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isArrayContainEqual(Object.keys(value), [
      'headerArquivo',
      'lotes',
      'trailerArquivo',
    ])
  );
}
