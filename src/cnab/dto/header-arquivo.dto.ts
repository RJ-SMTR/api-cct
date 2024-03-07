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
  tipoArquivo?: string;
  
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
  dataHoraGeracao?: Date;
  
  @ValidateIf(isCreate)
  @IsNotEmpty()
  transacao?: DeepPartial<Transacao>;
}
