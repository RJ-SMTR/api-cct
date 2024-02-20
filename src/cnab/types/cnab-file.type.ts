import { CnabLote } from './cnab-lote.type';
import { CnabRegistro } from './cnab-registro.type';

export type CnabFile = {
  headerArquivo: CnabRegistro;
  lotes: CnabLote[];
  trailerArquivo: CnabRegistro;
};
