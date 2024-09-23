import { HeaderArquivoDTO } from 'src/cnab/dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { Cnab104AmbienteCliente } from 'src/cnab/enums/104/cnab-104-ambiente-cliente.enum';
import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';

/**
 * @extends {CnabFields}
 *
 * @version v032 micro - FEV/2024
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

export class CnabHeaderArquivo104DTO implements CnabHeaderArquivo104 {
  constructor(dto: CnabHeaderArquivo104) {
    Object.assign(this, dto);
  }

  static fromDTO(headerArquivoDTO: HeaderArquivoDTO | HeaderArquivo, isTeste?: boolean): CnabHeaderArquivo104 {
    const headerArquivo104: CnabHeaderArquivo104 = structuredClone(Cnab104PgtoTemplates.file104.registros.headerArquivo);
    headerArquivo104.codigoBanco.value = headerArquivoDTO.codigoBanco;
    headerArquivo104.numeroInscricao.value = headerArquivoDTO.numeroInscricao;
    headerArquivo104.codigoConvenioBanco.value = headerArquivoDTO.codigoConvenio;
    headerArquivo104.parametroTransmissao.value = headerArquivoDTO.parametroTransmissao;
    headerArquivo104.agenciaContaCorrente.value = headerArquivoDTO.agencia;
    headerArquivo104.numeroConta.value = headerArquivoDTO.numeroConta;
    headerArquivo104.dvAgencia.value = headerArquivoDTO.dvAgencia;
    headerArquivo104.dvConta.value = headerArquivoDTO.dvConta;
    headerArquivo104.nomeEmpresa.value = headerArquivoDTO.nomeEmpresa;
    headerArquivo104.tipoArquivo.value = headerArquivoDTO.tipoArquivo;
    headerArquivo104.dataGeracaoArquivo.value = headerArquivoDTO.dataGeracao;
    headerArquivo104.horaGeracaoArquivo.value = headerArquivoDTO.horaGeracao;
    headerArquivo104.nsa.value = headerArquivoDTO.nsa;
    headerArquivo104.ambienteCliente.value = isTeste ? Cnab104AmbienteCliente.Teste : Cnab104AmbienteCliente.Producao;
    return headerArquivo104;
  }

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
