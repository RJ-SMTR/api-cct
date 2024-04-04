import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';

/**
 * Cnab240_104ExtratoDetalheE
 * @extends {CnabFields}
 */
export interface CnabDetalheE_104V089 {
  codigoBanco: CnabField;
  /** Lote de Serviço */
  loteServico: CnabField;
  /** Tipo de Registro  */
  codigoRegistro: CnabField;
  /** Nº Seqüencial do Registro no Lote  */
  nsr: CnabField;
  /** Código Segmento do Reg. Detalhe */
  codigoSegmento: CnabFieldAs<string>;
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
  complementoLancamento: CnabField;
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
