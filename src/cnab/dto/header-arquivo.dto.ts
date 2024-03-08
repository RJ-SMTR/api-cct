import { DeepPartial } from "typeorm";
import { Transacao } from "../entity/transacao.entity";
import { IsNotEmpty, ValidateIf } from "class-validator";

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
  tipoArquivo?: string | null;
  
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
  dataGeracao?: Date | null;
  
  @ValidateIf(isCreate)
  @IsNotEmpty()
  horaGeracao?: Date | null;
  
  @ValidateIf(isCreate)
  @IsNotEmpty()
  transacao?: DeepPartial<Transacao>;
}
