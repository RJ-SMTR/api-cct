import { CnabField } from '../../../types/cnab-field.type';

export interface ICnab240_104DetalheA {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabField;
  nsr: CnabField;
  codigoSegmento: CnabField;
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
  numeroDocumento: CnabField;
  filler: CnabField;
  tipoContaFinalidadeTed: CnabField;
  dataVencimento: CnabField;
  tipoMoeda: CnabField;
  quantidadeMoeda: CnabField;
  valorLancamento: CnabField;
  numeroDocumentoBanco: CnabField;
  filler2: CnabField;
  quantidadeParcelas: CnabField;
  indicadorBloqueio: CnabField;
  indicadorFormaParcelamento: CnabField;
  periodoDiaVencimento: CnabField;
  numeroParcela: CnabField;
  dataEfetivacao: CnabField;
  valorRealEfetivado: CnabField;
  informacao2: CnabField;
  finalidadeDOC: CnabField;
  usoFebraban: CnabField;
  avisoAoFavorecido: CnabField;
  /** Status do retorno CNAB */
  ocorrencias: CnabField;
}
