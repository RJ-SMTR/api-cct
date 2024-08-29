import { Injectable, Logger } from '@nestjs/common';
import { ItemTransacaoDTO } from 'src/cnab/dto/pagamento/item-transacao.dto';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { ItemTransacao } from 'src/cnab/entity/pagamento/item-transacao.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { ItemTransacaoRepository } from 'src/cnab/repository/pagamento/item-transacao.repository';
import { Lancamento } from 'src/lancamento/lancamento.entity';
import { CustomLogger } from 'src/utils/custom-logger';
import { logDebug } from 'src/utils/log-utils';
import { asObject } from 'src/utils/pipe-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, FindManyOptions, FindOptionsWhere, In, Not, QueryRunner } from 'typeorm';

@Injectable()
export class ItemTransacaoService {
  private logger: Logger = new CustomLogger('ItemTransacaoService', {
    timestamp: true,
  });

  constructor(private itemTransacaoRepository: ItemTransacaoRepository) {}

  async update(id: number, dto: DeepPartial<ItemTransacao>) {
    return await this.itemTransacaoRepository.update(id, dto);
  }

  // #region generateDTOsFromLancamentos

  /**
   * @param publicacoes Ready to save or saved Entity. Must contain valid Transacao
   */
  public generateDTOsFromLancamentos(lancamentos: Lancamento[], favorecidos: ClienteFavorecido[]): ItemTransacao[] {
    /** Key: id ClienteFavorecido. Eficient way to find favorecido. */
    const favorecidosMap: Record<string, ClienteFavorecido> = favorecidos.reduce((map, i) => ({ ...map, [i.id]: i }), {});

    const itens: ItemTransacao[] = [];

    // Mount DTOs
    for (const lancamento of lancamentos) {
      const favorecido = favorecidosMap[lancamento.clienteFavorecido.id];
      itens.push(this.generateDTOFromLancamento(lancamento, favorecido));
    }
    return itens;
  }

  /**
   * A simple pipe thar converts BigqueryOrdemPagamento into ItemTransacaoDTO.
   *
   * **status** is Created.
   */
  public generateDTOFromLancamento(lancamento: Lancamento, favorecido: ClienteFavorecido): ItemTransacao {
    const transacao = asObject<Transacao>(lancamento.transacao);
    /** detalheA = null, isRegistered = false */
    const itemTransacao = new ItemTransacao({
      clienteFavorecido: { id: favorecido.id },
      transacao: { id: transacao.id },
      valor: lancamento.valor_a_pagar,
      dataOrdem: lancamento.data_ordem,
    });
    return itemTransacao;
  }

  // #endregion

  /**
   * Bulk save Transacao.
   */
  public async saveMany(itens: ItemTransacao[]): Promise<ItemTransacao[]> {
    const insert = await this.itemTransacaoRepository.insert(itens);
    const ids: number[] = insert.identifiers.map((i) => i.id);
    if (ids.length === 0) {
      return [];
    }
    const newItens = await this.itemTransacaoRepository.findMany({
      where: { id: In(ids) },
    });
    return newItens;
  }

  public async findManyByIdTransacao(id_transacao: number): Promise<ItemTransacao[]> {
    return await this.itemTransacaoRepository.findMany({
      where: {
        transacao: {
          id: id_transacao,
        },
      },
    });
  }

  public async findMany(options: FindManyOptions<ItemTransacao>) {
    return await this.itemTransacaoRepository.findMany(options);
  }

  public async findOne(options: FindManyOptions<ItemTransacao>) {
    const many = await this.itemTransacaoRepository.findMany(options);
    return many.pop() || null;
  }

  public async save(dto: DeepPartial<ItemTransacao>, queryRunner: QueryRunner): Promise<ItemTransacao> {
    return await queryRunner.manager.getRepository(ItemTransacao).save(dto);
  }

  /**
   * Save if composite unique columns not exist. Otherwise, update.
   */
  public async saveManyIfNotExistsJae(dtos: DeepPartial<ItemTransacao>[]): Promise<ItemTransacao[]> {
    // Existing
    const existing = await this.itemTransacaoRepository.findMany({
      where: dtos.reduce(
        (l, i) => [
          ...l,
          {
            idOrdemPagamento: i.idOrdemPagamento,
            idOperadora: i.idOperadora,
            idConsorcio: i.idConsorcio,
          } as FindOptionsWhere<ItemTransacao>,
        ],
        [],
      ),
    });
    const existingMap: Record<string, ItemTransacao> = existing.reduce((m, i) => ({ ...m, [ItemTransacao.getUniqueIdJae(i)]: i }), {});

    // Check
    if (existing.length === dtos.length) {
      this.logger.warn(`${existing.length}/${dtos.length} ItemTransacoes já existem, nada a fazer...`);
    } else if (existing.length) {
      this.logger.warn(`${existing.length}/${dtos.length} ItemTransacoes já existem, ignorando...`);
      return [];
    }

    // Save new
    const newItems = dtos.filter((i) => !existingMap[ItemTransacao.getUniqueIdJae(i)]);
    const insert = await this.itemTransacaoRepository.insert(newItems);

    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce((l, i) => [...l, i.id], []);
    const savedItems = await this.itemTransacaoRepository.findMany({
      where: { id: In(insertIds) },
    });
    return savedItems;
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
      },
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

  public async getOldestDate(): Promise<Date | null> {
    return (
      (
        await this.itemTransacaoRepository.findOne({
          order: {
            dataOrdem: 'ASC',
          },
        })
      )?.dataOrdem || null
    );
  }

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
        transacao: {
          id: Not(transacaoDest.id),
          pagador: { id: transacaoDest.pagador.id },
        },
      },
    });
    if (allFailed.length === 0) {
      return;
    }
    for (const item of allFailed) {
      await this.itemTransacaoRepository.saveDTO({
        id: item.id,
        transacao: { id: transacaoDest.id },
      });
    }

    // Log
    const allIds = allFailed.reduce((l, i) => [...l, i.id], []).join(',');
    logDebug(this.logger, `ItemTr. #${allIds} movidos para Transacao #${transacaoDest.id}`, METHOD);
  }
}
