import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';

/**
 * @extends {CnabFields}
 */
export interface CnabTrailerLote104 {
  codigoBanco: CnabField;
  /** O mesmo valor que o `HeaderLote.loteServico` deste lote. */
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  usoExclusivoFebraban: CnabField;
  quantidadeRegistrosLote: CnabField;
  /** Soma de todos os valores: detalhe A, I, O, N */
  somatorioValores: CnabField;
  somatorioQtdeMoeda: CnabField;
  numeroAvisoDebito: CnabField;
  usoExclusivoFebraban2: CnabField;
  ocorrencias: CnabField;
}
