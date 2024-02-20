import { CnabField } from '../../../types/cnab-field.type';

export interface ICnab240CaixaTrailerLote {
  codigoBanco: CnabField;
  /** O mesmo valor que o `HeaderLote.loteServico` deste lote. */
  loteServico: CnabField;
  codigoRegistro: CnabField;
  usoExclusivoFebraban: CnabField;
  quantidadeRegistrosLote: CnabField;
  /** Soma de todos os valores: detalhe A, I, O, N */
  somatorioValores: CnabField;
  somatorioQtdeMoeda: CnabField;
  numeroAvisoDebito: CnabField;
  usoExclusivoFebraban2: CnabField;
  ocorrencias: CnabField;
}
