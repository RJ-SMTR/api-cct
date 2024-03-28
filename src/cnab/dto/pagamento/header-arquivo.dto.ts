import { DeepPartial } from "typeorm";
import { Transacao } from "../../entity/pagamento/transacao.entity";
import { IsNotEmpty, ValidateIf } from "class-validator";
import { HeaderArquivoStatus } from "src/cnab/entity/pagamento/header-arquivo-status.entity";

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
  codigoBanco?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoInscricao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroInscricao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoConvenio?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  parametroTransmissao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agencia?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvAgencia?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroConta?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvConta?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomeEmpresa?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataGeracao?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  horaGeracao?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  transacao?: DeepPartial<Transacao>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsa?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  status?: HeaderArquivoStatus;
}
