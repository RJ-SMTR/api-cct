import {
  CnabField,
  CnabFieldAs,
} from 'src/configuration/cnab/interfaces/cnab-all/cnab-field.interface';

/**
 * @extends {CnabFields}
 */
export interface CnabTrailerLote104 {
  codigoBanco: CnabField;
  /** O mesmo valor que o `HeaderLote.loteServico` deste lote. */
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  usoExclusivoFebraban: CnabField;
  /**
   * Preencher com a quantidade de registros dentro do lote,
   * considerar inclusive "HEADER" e "Trailer" do lote.
   * 
   * Retornado conforme recebido.
   */
  quantidadeRegistrosLote: CnabField;
  /** Soma de todos os valores: detalhe A, I, O, N */
  somatorioValores: CnabField;
  somatorioQtdeMoeda: CnabField;
  numeroAvisoDebito: CnabField;
  usoExclusivoFebraban2: CnabField;
  ocorrencias: CnabField;
}
