import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';

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
  /**
   * A.16
   *
   * Número Documento atribuído pela Empresa - gerado por nós
   *
   * Este número evoluir de 1 em 1 para cada registro dentro do arquivo.
   *
   * O campo deverá ser numérico e **não se repetir para mesma data de pagamento**.
   *
   * Detalhes: A, J, O, N
   */
  numeroDocumentoEmpresa: CnabFieldAs<number>;
  filler: CnabField;
  tipoContaFinalidadeTed: CnabField;
  dataVencimento: CnabFieldAs<Date>;
  tipoMoeda: CnabField;
  quantidadeMoeda: CnabFieldAs<number>;
  valorLancamento: CnabFieldAs<number>;
  /** Preencher com brancos. Retornado com brancos. */
  numeroDocumentoBanco: CnabFieldAs<number>;
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
  dataEfetivacao: CnabFieldAs<Date | null>;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  valorRealEfetivado: CnabFieldAs<number>;
  informacao2: CnabField;
  finalidadeDOC: CnabField;
  usoExclusivoFebraban: CnabField;
  /**  */
  avisoAoFavorecido: CnabField;
  /** Status do retorno CNAB */
  ocorrencias: CnabField;
}
