import { Injectable, Logger } from '@nestjs/common';
import { ItemTransacaoDTO } from 'src/cnab/dto/pagamento/item-transacao.dto';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { ItemTransacaoStatus } from 'src/cnab/entity/pagamento/item-transacao-status.entity';
import { ItemTransacao } from 'src/cnab/entity/pagamento/item-transacao.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { ItemTransacaoStatusEnum } from 'src/cnab/enums/pagamento/item-transacao-status.enum';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { ItemTransacaoRepository } from 'src/cnab/repository/pagamento/item-transacao.repository';
import { logDebug } from 'src/utils/log-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { Not } from 'typeorm';

@Injectable()
export class ItemTransacaoService {
  private logger: Logger = new Logger('ItemTransacaoService', { timestamp: true });

  constructor(
    private itemTransacaoRepository: ItemTransacaoRepository,
  ) { }

  /**
   * A simple pipe thar converts BigqueryOrdemPagamento into ItemTransacaoDTO.
   * 
   * **status** is Created.
   */
  public getItemTransacaoDTO(
    publicacao: ArquivoPublicacao,
    favorecido: ClienteFavorecido,
  ): ItemTransacao {
    const itemTransacao = new ItemTransacao({
      clienteFavorecido: { id: favorecido.id },
      favorecidoCpfCnpj: favorecido.cpfCnpj,
      transacao: { id: publicacao.transacao.id },
      valor: publicacao.valorTotalTransacaoLiquido,
      // Composite unique columns
      idOrdemPagamento: publicacao.idOrdemPagamento,
      idConsorcio: publicacao.idConsorcio,
      idOperadora: publicacao.idOperadora,
      // Control columns
      dataOrdem: publicacao.dataOrdem,
      nomeConsorcio: publicacao.nomeConsorcio,
      nomeOperadora: publicacao.nomeOperadora,
      // detalheA = null, isRegistered = false
      status: new ItemTransacaoStatus(ItemTransacaoStatusEnum.created),
    });
    return itemTransacao;
  }

  /**
   * Bulk save Transacao.
   */
  public async saveMany(itens: ItemTransacao[]) {
    await this.itemTransacaoRepository.insert(itens);
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

  public async getOldestDate(): Promise<Date | null> {
    return (await this.itemTransacaoRepository.findOne({
      order: {
        dataOrdem: 'ASC',
      },
    }))?.dataOrdem || null;
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
        status: { id: ItemTransacaoStatusEnum.failure },
        transacao: {
          id: Not(transacaoDest.id),
          pagador: { id: transacaoDest.pagador.id },
          status: { id: TransacaoStatusEnum.sentRemessa },
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

}