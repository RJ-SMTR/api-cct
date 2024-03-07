import { DeepPartial } from "typeorm";
import { HeaderArquivo } from "../entity/header-arquivo.entity";
import { IsNotEmpty, ValidateIf } from "class-validator";
import { Pagador } from "../entity/pagador.entity";

function isCreate(object: HeaderLoteDTO): boolean {
  return object.id === undefined;
}

export class HeaderLoteDTO {
  constructor(dto?: DeepPartial<HeaderLoteDTO>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  headerArquivo?: DeepPartial<HeaderArquivo>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  loteServico?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoInscricao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroInscricao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoConvenioBanco?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoCompromisso?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  parametroTransmissao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  pagador?: DeepPartial<Pagador>;
}
