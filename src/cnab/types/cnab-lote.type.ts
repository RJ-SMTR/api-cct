import { isArrayContainEqual } from 'src/utils/array-utils';
import { CnabRegistro, isCnabRegistro } from './cnab-registro.type';

export type CnabLote = {
  headerLote: CnabRegistro;
  registros: CnabRegistro[];
  trailerLote: CnabRegistro;
};

export function isCnabLote(value: any) {
  return (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isArrayContainEqual(Object.keys(value), [
      'headerLote',
      'registros',
      'trailerLote',
    ]) &&
    isCnabRegistro(value.headerLote)
  );
}
