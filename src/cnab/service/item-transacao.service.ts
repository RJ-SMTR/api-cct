import { Injectable, Logger } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { ItemTransacaoStatus } from '../entity/item-transacao-status.entity';
import { Transacao } from '../entity/transacao.entity';
import { ItemTransacaoStatusEnum } from '../enums/item-transacao/item-transacao-status.enum';
import { ItemTransacaoRepository } from '../repository/item-transacao.repository';
import { ItemTransacao } from './../entity/item-transacao.entity';
import { FindOptionsWhere } from 'typeorm';
import { logDebug } from 'src/utils/log-utils';

@Injectable()
export class ItemTransacaoService {
  private logger: Logger = new Logger('ItemTransacaoService', { timestamp: true });

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
   * Save if composite unique columns not exist. Otherwise, update.
   */
  public async saveIfNotExists(dto: ItemTransacaoDTO, updateIfExists?: boolean): Promise<SaveIfNotExists<ItemTransacao>> {
    // Find by composite unique columns
    const item = await this.itemTransacaoRepository.findOne({
      where: {
        idOrdemPagamento: dto.idOrdemPagamento,
        idOperadora: dto.idOperadora,
        idConsorcio: dto.idConsorcio,
        servico: dto.servico,
      }
    });

    if (item) {
      const itemResult = updateIfExists
        ? await this.itemTransacaoRepository.save({
          ...dto,
          id: item.id,
        })
        : item;
      return {
        isNewItem: false,
        item: itemResult,
      };
    } else {
      return {
        isNewItem: true,
        item: await this.itemTransacaoRepository.save(dto),
      };
    }
  }

  public async getOldestBigqueryDate(): Promise<Date | null> {
    return (await this.itemTransacaoRepository.findOne({
      order: {
        dataOrdem: 'ASC',
      },
    }))?.dataOrdem || null;
  }

  /**
   * Move all failed ItemTransacao to another Transacao with same Pagador, 
   * then reset status so we can try send again.
   */
  public async moveAllFailedToTransacao(transacao: Transacao) {
    const METHOD = 'moveAllFailedToTransacao()';
    const allFailed = await this.itemTransacaoRepository.findMany({
      status: { id: ItemTransacaoStatusEnum.failure },
      transacao: { pagador: { id: transacao.pagador.id } }
    });
    if (allFailed.length === 0) {
      return;
    }
    for (const item of allFailed) {
      await this.itemTransacaoRepository.save({
        id: item.id,
        transacao: { id: transacao.id },
        status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.created),
      });
    }

    // Log
    const allIds = allFailed.reduce((l, i) => [...l, i.id], []).join(',');
    logDebug(this.logger, `ItemTr. #${allIds} movidos para Transacao #${transacao.id}`, METHOD);
  }

  public async getExistingFromBQOrdemPagamento(
    ordens: BigqueryOrdemPagamentoDTO[]) {
    const fields = ordens.map(v => ({
      idOrdemPagamento: v.idOrdemPagamento,
      servico: v.servico,
      idOperadora: v.idOperadora,
      idConsorcio: v.idConsorcio,
    } as FindOptionsWhere<ItemTransacao>));
    return await this.itemTransacaoRepository.findMany(fields);
  }
}