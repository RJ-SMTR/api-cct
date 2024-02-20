import { CnabRegistro } from './cnab-registro.type';

export type CnabLote = {
  headerLote: CnabRegistro;
  registros: CnabRegistro[];
  trailerLote: CnabRegistro;
};
