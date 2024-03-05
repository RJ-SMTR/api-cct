import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { ItemTransacaoRepository } from '../repository/item-transacao.repository';
import { ItemTransacao } from './../entity/item-transacao.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ItemTransacaoService {
  constructor(private itemTransacaoRepository: ItemTransacaoRepository) { }

  public async findManyByIdTransacao(
    id_transacao: number,
  ): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.findMany({
      transacao: {
        id_transacao: id_transacao
      }
    });
  }

  public async save(dto: ItemTransacaoDTO): Promise<ItemTransacao> {
    return await this.itemTransacaoRepository.save(dto);
  }
} 