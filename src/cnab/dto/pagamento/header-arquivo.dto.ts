import { IsNotEmpty, ValidateIf } from 'class-validator';
import { HeaderArquivoConf } from 'src/cnab/entity/conference/header-arquivo-conf.entity';
import { HeaderArquivoStatus } from 'src/cnab/entity/pagamento/header-arquivo-status.entity';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { Cnab104AmbienteCliente } from 'src/cnab/enums/104/cnab-104-ambiente-cliente.enum';
import { DeepPartial } from 'typeorm';
import { Transacao } from '../../entity/pagamento/transacao.entity';

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
      _isConf: isConf,
    });
  }
  _isConf: boolean;

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoArquivo?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoBanco?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoInscricao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroInscricao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoConvenio?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  parametroTransmissao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvAgencia?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroConta?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvConta?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomeEmpresa?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataGeracao?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  horaGeracao?: Date;

  transacao?: DeepPartial<Transacao> | null;

  transacaoAgrupado?: DeepPartial<TransacaoAgrupado> | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsa?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  status?: HeaderArquivoStatus;

  ambienteCliente: Cnab104AmbienteCliente;
}
