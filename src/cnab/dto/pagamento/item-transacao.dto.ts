import { IsNotEmpty, ValidateIf } from "class-validator";
import { DeepPartial } from "typeorm";
import { ClienteFavorecido } from "../../entity/cliente-favorecido.entity";
import { Transacao } from "../../entity/pagamento/transacao.entity";
import { DetalheA } from "../../entity/pagamento/detalhe-a.entity";

function isCreate(object: ItemTransacaoDTO): boolean {
  return object.id === undefined;
}

export class ItemTransacaoDTO {
  constructor(dto?: ItemTransacaoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  transacao?: DeepPartial<Transacao>

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataTransacao?: Date;

  dataProcessamento?: Date;
  dataCaptura?: Date;
  nomeConsorcio?: string | null;
  nomeOperadora?: string | null;

  clienteFavorecido?: DeepPartial<ClienteFavorecido>;
  /** If no clienteFavorecido, use this static value to find if FK can be created. */
  favorecidoCpfCnpj?: string;

  // Composite unique

  @ValidateIf(isCreate)
  @IsNotEmpty()
  idOrdemPagamento?: string;

  /** CPF. */
  @ValidateIf(isCreate)
  @IsNotEmpty()
  idOperadora?: string;

  /** CNPJ */
  @ValidateIf(isCreate)
  @IsNotEmpty()
  idConsorcio?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valor?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataOrdem?: Date;

  detalheA?: DeepPartial<DetalheA> | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  versaoOrdemPagamento?: string;
}