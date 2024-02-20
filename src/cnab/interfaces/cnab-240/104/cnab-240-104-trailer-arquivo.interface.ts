import { CnabField } from '../../../types/cnab-field.type';

export interface ICnab240CaixaTrailerArquivo {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabField;
  usoExclusivoFebraban: CnabField;
  quantidadeLotesArquivo: CnabField;
  quantidadeRegistrosArquivo: CnabField;
  quantidadeContasConciliacao: CnabField;
  usoExclusivoFebraban2: CnabField;
}
