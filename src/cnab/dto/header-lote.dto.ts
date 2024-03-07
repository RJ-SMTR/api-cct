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
  loteServico?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoInscricao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroInscricao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoConvenioBanco?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoCompromisso?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  parametroTransmissao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  pagador?: DeepPartial<Pagador>;
}
