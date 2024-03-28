import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-field.interface';

/**
 * Cnab240_104ExtratoDetalheE
 * @extends {CnabFields}
 */
export interface CnabDetalheE_104V030 {
  codigoBanco: CnabField;
  /** Lote de Serviço */
  loteServico: CnabFieldAs<number>;
  /** Tipo de Registro  */
  codigoRegistro: CnabField;
  /** Nº Seqüencial do Registro no Lote  */
  nsr: CnabFieldAs<number>;
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
  nomeEmpresa: CnabFieldAs<string>;
  usoExclusivoFebraban2: CnabField;
  dataLancamento: CnabFieldAs<Date>;
  valorLancamento: CnabFieldAs<number>;
  tipoLancamento: CnabField;
  categoriaLancamento: CnabField;
  codigoHistoricoBanco: CnabField;
  /** Descrição do histórico do lançamento do extrato bancário */
  descricaoHistoricoBanco: CnabFieldAs<string>;
  /** 
   * Número Documento/Complemento. Atribuído pela empresa.
   * 
   * ID do registro no arquivo.
   */
  numeroDocumento: CnabField;
}
