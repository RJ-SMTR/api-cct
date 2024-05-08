import { DeepPartial } from 'typeorm';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { IsNotEmpty, ValidateIf } from 'class-validator';
import { Pagador } from '../../entity/pagamento/pagador.entity';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';

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
  loteServico?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoInscricao?: string | null;

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

  ocorrencias?: Ocorrencia[];

  ocorrenciasCnab?: string | null;
}
