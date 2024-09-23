import { IsNotEmpty, ValidateIf } from 'class-validator';
import { HeaderArquivoConf } from 'src/cnab/entity/conference/header-arquivo-conf.entity';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { Cnab104AmbienteCliente } from 'src/cnab/enums/104/cnab-104-ambiente-cliente.enum';
import { DeepPartial } from 'typeorm';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { HeaderArquivoTipoArquivo } from 'src/cnab/enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { HeaderArquivoStatus } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { Exclude, Expose } from 'class-transformer';

function isCreate(object: HeaderArquivoDTO): boolean {
  return object.id === undefined;
}

export class HeaderArquivoDTO {
  constructor(dto?: HeaderArquivoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  static fromEntity(entity: HeaderArquivo | HeaderArquivoConf, isConf: boolean) {
    return new HeaderArquivoDTO({
      id: entity.id,
      tipoArquivo: entity.tipoArquivo,
      codigoBanco: entity.codigoBanco,
      tipoInscricao: entity.tipoInscricao,
      numeroInscricao: entity.numeroInscricao,
      codigoConvenio: entity.codigoConvenio,
      parametroTransmissao: entity.parametroTransmissao,
      agencia: entity.agencia,
      dvAgencia: entity.dvAgencia,
      numeroConta: entity.numeroConta,
      dvConta: entity.dvConta,
      nomeEmpresa: entity.nomeEmpresa,
      dataGeracao: entity.dataGeracao,
      horaGeracao: entity.horaGeracao,
      transacaoAgrupado: entity.transacaoAgrupado,
      nsa: entity.nsa,
      ambienteCliente: entity.ambienteCliente,
      remessaName: entity.remessaName,
      _isConf: isConf,
    });
  }

  static newCreated(tipo_arquivo: HeaderArquivoTipoArquivo, transacaoAg: TransacaoAgrupado, pagador: Pagador, nsa: number, isConf: boolean, isTeste?: boolean) {
    const now = new Date();
    return new HeaderArquivoDTO({
      _isConf: isConf,
      agencia: pagador.agencia,
      codigoBanco: Cnab104PgtoTemplates.file104.registros.headerArquivo.codigoBanco.value,
      tipoInscricao: Cnab104PgtoTemplates.file104.registros.headerArquivo.tipoInscricao.value,
      numeroInscricao: String(pagador.cpfCnpj),
      codigoConvenio: Cnab104PgtoTemplates.file104.registros.headerArquivo.codigoConvenioBanco.value,
      parametroTransmissao: Cnab104PgtoTemplates.file104.registros.headerArquivo.parametroTransmissao.value,
      dataGeracao: now,
      horaGeracao: now,
      dvAgencia: pagador.dvAgencia,
      dvConta: pagador.dvConta,
      transacaoAgrupado: transacaoAg,
      nomeEmpresa: pagador.nomeEmpresa,
      numeroConta: pagador.conta,
      tipoArquivo: tipo_arquivo,
      nsa,
      ambienteCliente: isTeste ? Cnab104AmbienteCliente.Teste : Cnab104AmbienteCliente.Producao,
    });
  }

  @Expose({ name: 'isConf' })
  _isConf: boolean;

  id?: number;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoArquivo?: number;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoBanco?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoInscricao?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroInscricao?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoConvenio?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  parametroTransmissao?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvAgencia?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroConta?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvConta?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomeEmpresa?: string;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataGeracao?: Date;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  horaGeracao?: Date;

  @Exclude()
  transacaoAgrupado?: DeepPartial<TransacaoAgrupado> | null;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsa?: number;

  @Exclude()
  ambienteCliente: Cnab104AmbienteCliente;

  @Exclude()
  @ValidateIf(isCreate)
  @IsNotEmpty()
  status?: HeaderArquivoStatus;

  @Exclude()
  remessaName?: string | null;

  @Exclude()
  retornoName?: string | null;

  @Exclude()
  retornoDatetime?: Date | null;
}
