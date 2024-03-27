import { IsNotEmpty, ValidateIf } from 'class-validator';
import { DeepPartial } from 'typeorm';
import { ClienteFavorecido } from '../../entity/cliente-favorecido.entity';
import { HeaderLote } from '../../entity/pagamento/header-lote.entity';

function isCreate(object: DetalheADTO): boolean {
  return object.id === undefined;
}

export class DetalheADTO {
  constructor(dto?: DetalheADTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  headerLote?: DeepPartial<HeaderLote>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  clienteFavorecido?: DeepPartial<ClienteFavorecido>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  loteServico?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  finalidadeDOC?: string | null;

  /** Automático, sequencial. */
  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroDocumentoEmpresa?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataVencimento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoMoeda?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeMoeda?: number | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorLancamento?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroDocumentoBanco?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  quantidadeParcelas?: number | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  indicadorBloqueio?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  indicadorFormaParcelamento?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  periodoVencimento?: Date | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroParcela?: number | null;

  dataEfetivacao?: Date;
  valorRealEfetivado?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nsr?: number;

  ocorrencias: string | null;
}
