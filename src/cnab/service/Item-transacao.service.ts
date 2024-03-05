import { ItemTransacaoRepository } from '../repository/item-transacao.repository';
import { ItemTransacao } from './../entity/item-transacao.entity';
export class ItemTransacaoService {
  constructor(private itemTransacaoRepository: ItemTransacaoRepository) {}

  public async getByIdTransacao(
    id_transacao: number,
  ): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.find(id_transacao);
  }
}
