import { IsNotEmpty, ValidateIf } from "class-validator";
import { DeepPartial } from "typeorm";
import { ClienteFavorecido } from "../../entity/cliente-favorecido.entity";
import { Transacao } from "../../entity/intermediate/transacao.entity";
import { DetalheA } from "../../entity/pagamento/detalhe-a.entity";
import { ItemTransacaoStatus } from "../../entity/intermediate/item-transacao-status.entity";

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

  clienteFavorecido?: DeepPartial<ClienteFavorecido> | null;

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

  /** Veículo */
  @ValidateIf(isCreate)
  @IsNotEmpty()
  servico?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valor?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataOrdem?: Date;


  @ValidateIf(isCreate)
  @IsNotEmpty()
  status?: DeepPartial<ItemTransacaoStatus>;

  detalheA?: DeepPartial<DetalheA> | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  versaoOrdemPagamento?: string;

}