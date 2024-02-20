import { isArrayContainEqual } from 'src/utils/array-utils';
import { CnabRegistro } from './cnab-registro.type';

export type CnabLote = {
  headerLote: CnabRegistro;
  registros: CnabRegistro[];
  trailerLote: CnabRegistro;
};

export function isCnabLote(value: any) {
  return (
    typeof value === 'object' &&
    isArrayContainEqual(Object.keys(value), [
      'headerLote',
      'registros',
      'trailerLote',
    ])
  );
}
