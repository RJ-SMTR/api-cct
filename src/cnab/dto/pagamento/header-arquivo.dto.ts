import { DeepPartial } from "typeorm";
import { Transacao } from "../../entity/pagamento/transacao.entity";
import { IsNotEmpty, ValidateIf } from "class-validator";
import { HeaderArquivoStatus } from "src/cnab/entity/pagamento/header-arquivo-status.entity";
import { TransacaoAgrupado } from "src/cnab/entity/pagamento/transacao-agrupado.entity";

function isCreate(object: HeaderArquivoDTO): boolean {
  return object.id === undefined;
}

export class HeaderArquivoDTO {
  constructor(dto?: HeaderArquivoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

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
}
