import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import { CnabField, CnabFieldAs } from 'src/cnab/types/cnab-field.type';

/**
 * @extends {CnabFields}
 */
export interface ICnab240_104HeaderLote {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<CnabAllCodigoRegistro>;
  tipoOperacao: CnabField;
  tipoServico: CnabField;
  formaLancamento: CnabField;
  versaoLeiauteLote: CnabField;
  filler: CnabField;
  tipoInscricao: CnabField;
  numeroInscricao: CnabField;
  codigoConvenioBanco: CnabField;
  tipoCompromisso: CnabField;
  codigoCompromisso: CnabField;
  parametroTransmissao: CnabField;
  filler2: CnabField;
  agenciaContaCorrente: CnabField;
  dvAgencia: CnabField;
  numeroConta: CnabField;
  dvConta: CnabField;
  dvAgenciaConta: CnabField;
  nomeEmpresa: CnabField;
  mensagemAviso: CnabField;
  logradouro: CnabField;
  numeroLocal: CnabField;
  /** @example "Apto 503" */
  complemento: CnabField;
  cidade: CnabField;
  /** @example "12345" */
  cep: CnabField;
  /** @example "678" */
  complementoCep: CnabField;
  /** @example "RJ" */
  siglaEstado: CnabField;
  usoExclusivoFebraban: CnabField;
  /**
   * Retorna o status de retorno do CNAB (Tabela G059)
   * @see `cnab104OcorrenciasMap`
   */
  ocorrencias: CnabField;
}
