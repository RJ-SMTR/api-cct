import { IsNotEmpty, ValidateIf } from 'class-validator';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { DeepPartial } from 'typeorm';
import { HeaderLote } from '../entity/header-lote.entity';

function isCreate(object: DetalheADTO): boolean {
  return object.id === undefined;
}

export class DetalheADTO {
  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  headerLote?: DeepPartial<HeaderLote>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  loteServico?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  clienteFavorecido?: DeepPartial<ClienteFavorecido>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoFinalidadeConta?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataVencimento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoMoeda?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeMoeda?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorLancamento?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroDocumentoLancamento?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeParcelas?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  indicadorBloqueio?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  indicadorFormaParcelamento?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  periodoVencimento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroParcela?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataEfetivacao?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorRealEfetivado?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsr?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  ocorrencias: string;
}
