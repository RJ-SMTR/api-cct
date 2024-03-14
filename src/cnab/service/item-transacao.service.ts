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
        id: id_transacao
      }
    });
  }

  public async save(dto: ItemTransacaoDTO): Promise<ItemTransacao> {
    return await this.itemTransacaoRepository.save(dto);
  }

  /**
   * Save if composite unique columns not exist.
   */
  public async saveIfNotExists(dto: ItemTransacaoDTO): Promise<ItemTransacao> {
    // Find by composite unique columns
    const item = await this.itemTransacaoRepository.findOne({
      idOrdemPagamento: dto.idOrdemPagamento,
      idOperadora: dto.idOperadora,
      idConsorcio: dto.idConsorcio,
      servico: dto.servico,
    });

    if (item) {
      return item;
    } else {
      return await this.itemTransacaoRepository.save(dto);
    }
  }
} 