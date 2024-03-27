import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-field.interface';

/**
 * @extends {CnabFields}
 */
export interface CnabDetalheA_104 {
  codigoBanco: CnabField;
  loteServico: CnabFieldAs<number>;
  codigoRegistro: CnabFieldAs<number>;
  nsr: CnabFieldAs<number>;
  codigoSegmento: CnabFieldAs<string>;
  tipoMovimento: CnabField;
  codigoInstrucaoMovimento: CnabField;
  camaraCompensacao: CnabField;
  codigoBancoDestino: CnabField;
  codigoAgenciaDestino: CnabField;
  dvAgenciaDestino: CnabField;
  contaCorrenteDestino: CnabField;
  dvContaDestino: CnabField;
  dvAgenciaContaDestino: CnabField;
  nomeTerceiro: CnabField;
  /** Atribuído pela empresa. Sequencial, automático. */
  numeroDocumentoEmpresa: CnabFieldAs<number>;
  filler: CnabField;
  tipoContaFinalidadeTed: CnabField;
  dataVencimento: CnabFieldAs<Date>;
  tipoMoeda: CnabField;
  quantidadeMoeda: CnabFieldAs<number>;
  valorLancamento: CnabFieldAs<number>;
  numeroDocumentoBanco: CnabField;
  filler2: CnabField;
  /** `1` = à vista */
  quantidadeParcelas: CnabFieldAs<number>;
  indicadorBloqueio: CnabField;
  indicadorFormaParcelamento: CnabField;
  periodoDiaVencimento: CnabField;
  numeroParcela: CnabFieldAs<number>;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  dataEfetivacao: CnabFieldAs<Date>;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  valorRealEfetivado: CnabFieldAs<number>;
  informacao2: CnabField;
  finalidadeDOC: CnabField;
  usoExclusivoFebraban: CnabField;
  avisoAoFavorecido: CnabField;
  /** Status do retorno CNAB */
  ocorrencias: CnabField;
}
