import { Injectable, Logger } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { ItemTransacaoDTO } from 'src/cnab/dto/pagamento/item-transacao.dto';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { ItemTransacaoStatus } from 'src/cnab/entity/pagamento/item-transacao-status.entity';
import { ItemTransacao } from 'src/cnab/entity/pagamento/item-transacao.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { ItemTransacaoStatusEnum } from 'src/cnab/enums/pagamento/item-transacao-status.enum';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { ItemTransacaoPK } from 'src/cnab/interfaces/pagamento/item-transacao-pk.interface';
import { ItemTransacaoRepository } from 'src/cnab/repository/pagamento/item-transacao.repository';
import { filterArrayInANotInB } from 'src/utils/array-utils';
import { SaveManyNew } from 'src/utils/interfaces/save-many-new.interface';
import { logDebug } from 'src/utils/log-utils';
import { asStringDate } from 'src/utils/pipe-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, FindOptionsWhere, IsNull, Not } from 'typeorm';

@Injectable()
export class ItemTransacaoService {
  private logger: Logger = new Logger('ItemTransacaoService', { timestamp: true });

  constructor(
    private itemTransacaoRepository: ItemTransacaoRepository,
  ) { }

  /**
   * Bulk save Transacao if composed PKs not exists
   */
  public async saveManyNewFromOrdem(
    transacoes: Transacao[],
    ordens: BigqueryOrdemPagamentoDTO[],
    favorecidos: ClienteFavorecido[],
  ): Promise<SaveManyNew<ItemTransacao>> {
    const uniquePKs = this.getItemPKsFromOrdens(ordens);
    const existingItems = await this.itemTransacaoRepository.findMany({ where: uniquePKs });
    const existingPKs = this.getItemPKs(existingItems);
    const notExistingPKs = filterArrayInANotInB(uniquePKs, existingPKs);
    const notExistingPKsAux = notExistingPKs.reduce((l, i) => [...l, JSON.stringify(i)], []);
    const newItems: ItemTransacaoDTO[] = [];
    let transacaoAux = transacoes[0];
    for (const ordem of ordens) {
      if (notExistingPKsAux.length === 0) {
        break;
      }
      const pk = JSON.stringify(this.getItemPKsFromOrdens([ordem])[0]);
      if (notExistingPKsAux.includes(pk)) {
        const favorecido = favorecidos.filter(i =>
          i.cpfCnpj === ordem.operadoraCpfCnpj ||
          i.cpfCnpj === ordem.consorcioCpfCnpj
        ).pop() || null;
        if (ordem.idOrdemPagamento !== transacaoAux.idOrdemPagamento) {
          transacaoAux = transacoes.filter(i => i.idOrdemPagamento === ordem.idOrdemPagamento)[0];
        }
        if (!favorecido) {
          continue;
        }
        const newDTO = this.ordemPagamentoToItemTransacaoDTO(ordem, transacaoAux.id, favorecido);
        newItems.push(newDTO);
        notExistingPKsAux.splice(notExistingPKsAux.indexOf(pk), 1);
      }
    }
    const insertResult = await this.itemTransacaoRepository.insert(newItems);
    const insertedTransacoes = await this.itemTransacaoRepository.findMany({
      where: insertResult.identifiers as ItemTransacaoPK[]
    });
    return {
      existing: existingItems,
      inserted: insertedTransacoes,
    }
  }

  /**
   * A simple pipe thar converts BigqueryOrdemPagamento into ItemTransacaoDTO.
   * 
   * **status** is Created.
   */
  public ordemPagamentoToItemTransacaoDTO(ordemPagamento: BigqueryOrdemPagamentoDTO, transacaoId: number,
    favorecido: ClienteFavorecido): ItemTransacaoDTO {
    const itemTransacao = new ItemTransacaoDTO({
      dataTransacao: asStringDate(ordemPagamento.dataOrdem),
      clienteFavorecido: { id: favorecido.id },
      favorecidoCpfCnpj: favorecido.cpfCnpj,
      transacao: { id: transacaoId },
      valor: ordemPagamento.valorTotalTransacaoLiquido,
      // Composite unique columns
      idOrdemPagamento: ordemPagamento.idOrdemPagamento,
      servico: ordemPagamento.servico,
      idConsorcio: ordemPagamento.idConsorcio,
      idOperadora: ordemPagamento.idOperadora,
      // Control columns
      dataOrdem: asStringDate(ordemPagamento.dataOrdem),
      nomeConsorcio: ordemPagamento.consorcio,
      nomeOperadora: ordemPagamento.operadora,
      versaoOrdemPagamento: ordemPagamento.versao,
      // detalheA = null, isRegistered = false
      status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.created),
    });
    return itemTransacao;
  }

  /**
   * From ClienteFavorecido items, find ItemTransacao with missing ClienteFavorecido FK (null).
   * 
   * If cpfCnpj matches ClienteFavorecido, update ItemTransacao.
   */
  public async updateWithMissingFavorecidos(favorecidos: ClienteFavorecido[]) {
    const METHOD = 'updateMissingFavorecidos()';
    const incompletes = await this.getMissingFavorecidos();
    const updates: DeepPartial<ItemTransacao>[] = [];
    for (const favorecido of favorecidos) {
      const foundItems = incompletes.filter(i => i.favorecidoCpfCnpj === favorecido.cpfCnpj);
      if (foundItems.length > 0) {
        const newUpdates: DeepPartial<ItemTransacao>[] = foundItems.map(v => ({
          id: v.id,
          clienteFavorecido: { id: favorecido.id },
        }));
        updates.push(...newUpdates);
      }
    }
    if (updates.length > 0) {
      for (const update of updates) {
        await this.itemTransacaoRepository.save(update);
      }
      logDebug(this.logger, `${updates.length} ItemTransacao agora possuem Favorecidos.`, METHOD);
    }
  }

  public async getMissingFavorecidos(): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.findMany({
      where: { clienteFavorecido: IsNull() }
    });
  }

  /**
   * Filter ItemTransacao to get a list with composed PK (unique).
   */
  public getItemPKs(
    itens: ItemTransacao[],
  ): ItemTransacaoPK[] {
    return itens.reduce((l, i) => [...l, {
      idOrdemPagamento: i.idOrdemPagamento,
      idOperadora: i.idOperadora,
      idConsorcio: i.idConsorcio,
      servico: i.servico,
    }], []);
  }

  /**
   * Filter ordens to get a list with composed PK (unique).
   */
  public getItemPKsFromOrdens(
    ordens: BigqueryOrdemPagamentoDTO[],
  ): ItemTransacaoPK[] {
    return ordens.reduce((l, i) => [...l, {
      idOrdemPagamento: i.idOrdemPagamento,
      idOperadora: i.idOperadora,
      idConsorcio: i.idConsorcio,
      servico: i.servico,
    }], []);
  }

  public async findManyByIdTransacao(
    id_transacao: number,
  ): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.findMany({
      where: {
        transacao: {
          id: id_transacao
        }
      }
    });
  }

  public async save(dto: ItemTransacaoDTO): Promise<ItemTransacao> {
    return await this.itemTransacaoRepository.saveDTO(dto);
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
        ? await this.itemTransacaoRepository.saveDTO({
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
        item: await this.itemTransacaoRepository.saveDTO(dto),
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
   * Move all failed ItemTransacao to another new Transacao with same Pagador, 
   * then reset status so we can try send again.
   * 
   * If there are ItemTransacao with no new Transacao for the same Pagador,
   * insert new transacao as cct_idOrdemPagamento for the Pagador.
   */
  // public async moveAllFailedToTransacoes(newTransacoes: Transacao[]) {
  //   const METHOD = 'moveAllFailedToTransacoes()';
  //   const transacoesByPagador = getUniqueFromArray(newTransacoes, ['pagador']);
  //   const pagadorIds = transacoesByPagador.reduce((l, i) => [...l, i.pagador], []);
  //   const allFailed = await this.itemTransacaoRepository.findMany({
  //     where: transacoesByPagador.map(i => ({
  //       status: { id: ItemTransacaoStatusEnum.failure },
  //       transacao: { pagador: { id: i.pagador.id } }
  //     })),
  //     order: {
  //       transacao: { pagador: { id: 'ASC' } }
  //     }
  //   });
  //   if (allFailed.length === 0) {
  //     return;
  //   }
  //   for (const item of allFailed) {
  //     await this.itemTransacaoRepository.saveDTO({
  //       id: item.id,
  //       transacao: { id: transacao.id },
  //       status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.created),
  //     });
  //   }

  //   // Log
  //   const allIds = allFailed.reduce((l, i) => [...l, i.id], []).join(',');
  //   logDebug(this.logger, `ItemTr. #${allIds} movidos para Transacao #${transacao.id}`, METHOD);
  // }

  /**
   * Move all ItemTransacao that is:
   * - failed
   * - has Transacao used
   * - has different Transacao
   * - has Transacao.pagador the same as Transacao dest
   * to another Transacao with same Pagador, 
   * then reset status so we can try send again.
   */
  public async moveAllFailedToTransacao(transacaoDest: Transacao) {
    const METHOD = 'moveAllFailedToTransacao()';
    const allFailed = await this.itemTransacaoRepository.findMany({
      where: {
        status: { id: ItemTransacaoStatusEnum.failure },
        transacao: {
          id: Not(transacaoDest.id),
          pagador: { id: transacaoDest.pagador.id },
          status: { id: TransacaoStatusEnum.used },
        }
      }
    });
    if (allFailed.length === 0) {
      return;
    }
    for (const item of allFailed) {
      await this.itemTransacaoRepository.saveDTO({
        id: item.id,
        transacao: { id: transacaoDest.id },
        status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.created),
      });
    }

    // Log
    const allIds = allFailed.reduce((l, i) => [...l, i.id], []).join(',');
    logDebug(this.logger, `ItemTr. #${allIds} movidos para Transacao #${transacaoDest.id}`, METHOD);
  }

  public async getExistingFromBQOrdemPagamento(
    ordens: BigqueryOrdemPagamentoDTO[]) {
    const fields = ordens.map(v => ({
      idOrdemPagamento: v.idOrdemPagamento,
      servico: v.servico,
      idOperadora: v.idOperadora,
      idConsorcio: v.idConsorcio,
    } as FindOptionsWhere<ItemTransacao>));
    return await this.itemTransacaoRepository.findMany({ where: fields });
  }
}