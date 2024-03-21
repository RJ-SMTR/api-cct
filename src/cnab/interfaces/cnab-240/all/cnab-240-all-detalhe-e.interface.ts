import { CnabField } from 'src/cnab/types/cnab-field.type';

/**
 * @extends {CnabFields}
 */
export interface ICnab240AllDetalheE {
  codigoBanco: CnabField;
  /** Lote de Serviço */
  loteServico: CnabField;
  /** Tipo de Registro  */
  codigoRegistro: CnabField;
  /** Nº Seqüencial do Registro no Lote  */
  nsr: CnabField;
  /** Código Segmento do Reg. Detalhe */
  codigoSegmento: CnabField;
  usoExclusivoFebraban: CnabField;
  /** Empresa */
  tipoInscricao: CnabField;
  /** Empresa */
  numeroInscricao: CnabField;
  /** Empresa */
  codigoConvenioBanco: CnabField;
  /** Empresa */
  agencia: CnabField;
  /** Empresa */
  dvAgencia: CnabField;
  /** Empresa */
  conta: CnabField;
  /** Empresa */
  dvConta: CnabField;
  /** Empresa */
  dvAgenciaConta: CnabField;
  nomeEmpresa: CnabField;
  usoExclusivoFebraban2: CnabField;
  naturezaLancamento: CnabField;
  tipoComplementoLancamento: CnabField;
  isencaoCpmf: CnabField;
  /** Data de efetivação */
  dataContabil: CnabField;
  dataLancamento: CnabField;
  valorLancamento: CnabField;
  tipoLancamento: CnabField;
  categoriaLancamento: CnabField;
  codigoHistoricoBanco: CnabField;
  /** Descrição do histórico do lançamento do extrato bancário */
  descricaoHistoricoBanco: CnabField;
  /** Número Documento/Complemento. Atribuído pela empresa  */
  numeroDocumento: CnabField;
}
