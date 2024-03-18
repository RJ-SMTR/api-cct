import { CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import { CnabField, CnabFieldAs } from 'src/cnab/types/cnab-field.type';

/**
 * @extends {CnabFields}
 */
export interface ICnab240_104HeaderArquivo {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<CnabAllCodigoRegistro>;
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
  nomeEmpresa: CnabField;
  nomeBanco: CnabField;
  filler3: CnabField;
  tipoArquivo: CnabField;
  dataGeracaoArquivo: CnabField;
  horaGeracaoArquivo: CnabField;

  /** Número sequencial de arquivo, id único do arquivo CNAB. */
  nsa: CnabField;

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
