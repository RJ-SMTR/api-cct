import { IsNotEmpty, ValidateIf } from "class-validator";
import { DeepPartial } from "typeorm";
import { ClienteFavorecido } from "../entity/cliente-favorecido.entity";
import { Transacao } from "../entity/transacao.entity";

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

  @IsNotEmpty()
  transacao: DeepPartial<Transacao>

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataTransacao?: Date;

  dataProcessamento?: Date;
  dataCaptura?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  clienteFavorecido?: DeepPartial<ClienteFavorecido>;

  // Composite unique
  idOrdemPagamento: string;

  /** CPF. */
  idOperadora: string;

  /** CNPJ */
  idConsorcio: string;

  /** Veículo */
  servico: string;

  valor: number;
}