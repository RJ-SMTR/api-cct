import { CnabRegistro } from './cnab-registro.interface';

export interface CnabLote {
  _type: 'CnabLote';
  headerLote: CnabRegistro;
  registros: CnabRegistro[];
  trailerLote: CnabRegistro;
}

export function isCnabLote(obj: any): obj is CnabLote {
  return obj?._type === 'CnabLote';
}
