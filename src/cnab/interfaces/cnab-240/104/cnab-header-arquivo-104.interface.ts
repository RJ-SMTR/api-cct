import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';

/**
 * @extends {CnabFields}
 */
export interface CnabHeaderArquivo104 {
  codigoBanco: CnabField;
  loteServico: CnabFieldAs<number>;
  codigoRegistro: CnabFieldAs<number>;
  filler: CnabField;
  tipoInscricao: CnabField;
  numeroInscricao: CnabField;
  codigoConvenioBanco: CnabField;
  parametroTransmissao: CnabField;
  ambienteCliente: CnabField;
  ambienteCaixa: CnabField;
  origemAplicativo: CnabField;
  numeroVersao: CnabField;
  filler2: CnabField;
  agenciaContaCorrente: CnabField;
  numeroConta: CnabField;
  dvAgencia: CnabField;
  dvConta: CnabField;
  dvAgenciaConta: CnabField;
  nomeEmpresa: CnabFieldAs<string>;
  nomeBanco: CnabFieldAs<string>;
  filler3: CnabField;
  tipoArquivo: CnabFieldAs<number>;
  dataGeracaoArquivo: CnabFieldAs<Date>;
  horaGeracaoArquivo: CnabFieldAs<Date>;
  /** Número sequencial de arquivo, id único do arquivo CNAB. */
  nsa: CnabFieldAs<number>;
  versaoLeiauteArquivo: CnabField;
  densidadeGravacao: CnabField;
  reservadoBanco: CnabField;
  reservadoEmpresa: CnabField;
  usoExclusivoFebraban: CnabField;
  identidadeCobranca: CnabField;
  usoExclusivoVan: CnabField;
  tipoServico: CnabField;
  ocorrenciaCobrancaSemPapel: CnabField;
}
