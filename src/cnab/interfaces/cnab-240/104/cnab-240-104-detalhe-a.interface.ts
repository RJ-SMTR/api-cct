import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import {
  CnabField,
  CnabFieldAs,
  CnabFields,
} from '../../../types/cnab-field.type';
import { Cnab104CodigoSegmento } from 'src/cnab/enums/104/cnab-104-codigo-segmento.enum';

export interface ICnab240_104DetalheA extends CnabFields {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<CnabAllCodigoRegistro>;
  nsr: CnabField;
  codigoSegmento: CnabFieldAs<Cnab104CodigoSegmento>;
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
  /** Atribuído pela empresa */
  numeroDocumentoEmpresa: CnabField;
  filler: CnabField;
  tipoContaFinalidadeTed: CnabField;
  dataVencimento: CnabField;
  tipoMoeda: CnabField;
  quantidadeMoeda: CnabField;
  valorLancamento: CnabField;
  numeroDocumentoBanco: CnabField;
  filler2: CnabField;
  /** `1` = à vista */
  quantidadeParcelas: CnabField;
  indicadorBloqueio: CnabField;
  indicadorFormaParcelamento: CnabField;
  periodoDiaVencimento: CnabField;
  numeroParcela: CnabField;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  dataEfetivacao: CnabField;
  /**
   * Na remessa deve ser preenchido com zeros.
   * Retornado com o valor efetivamente debitado/creditado.
   */
  valorRealEfetivado: CnabField;
  informacao2: CnabField;
  finalidadeDOC: CnabField;
  usoExclusivoFebraban: CnabField;
  avisoAoFavorecido: CnabField;
  /** Status do retorno CNAB */
  ocorrencias: CnabField;
}
