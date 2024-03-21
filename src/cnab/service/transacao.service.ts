
import { Injectable, Logger } from '@nestjs/common';
import { BigqueryOrdemPagamentoService } from 'src/bigquery/services/bigquery-ordem-pagamento.service';
import { asNullableStringDate, asString, asStringDate } from 'src/utils/pipe-utils';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';
import { Transacao } from '../entity/transacao.entity';
import { PagadorContaEnum } from '../enums/pagador/pagador.enum';
import { TransacaoRepository } from '../repository/transacao.repository';
import { TransacaoDTO } from './../dto/transacao.dto';
import { ClienteFavorecidoService } from './cliente-favorecido.service';

import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { logWarn } from 'src/utils/log-utils';
import { InvalidRows } from 'src/utils/types/invalid-rows.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { ItemTransacaoStatus } from '../entity/item-transacao-status.entity';
import { Pagador } from '../entity/pagador.entity';
import { TransacaoStatus } from '../entity/transacao-status.entity';
import { ItemTransacaoStatusEnum } from '../enums/item-transacao/item-transacao-status.enum';
import { TransacaoStatusEnum } from '../enums/transacao/transacao-status.enum';
import { TransacaoTarget } from '../types/transacao/transacao-target.type';
import { ItemTransacaoService } from './item-transacao.service';
import { PagadorService } from './pagador.service';

@Injectable()
export class TransacaoService {
  private logger: Logger = new Logger('TransacaoService', {
    timestamp: true,
  });

  constructor(
    private transacaoRepository: TransacaoRepository,
    private itemTransacaoService: ItemTransacaoService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private pagadorService: PagadorService,
    private bigqueryOrdemPagamentoService: BigqueryOrdemPagamentoService,
  ) { }

  public async updateTransacaoFromJae(target: TransacaoTarget) {
    const METHOD = 'updateTransacaoFromJae()';
    // Update cliente favorecido
    await this.clienteFavorecidoService.updateAllFromUsers();

    // Update transacao
    const ordens = await this.getOrdemPagamentoFromTarget(target)
    const newOrdens = await this.filterNewOrdemPagamento(ordens);
    const pagador = await this.getPagadorFromTarget(target);
    const errors: {
      versao: string,
      error: InvalidRows,
    }[] = [];

    for (const ordemPagamento of newOrdens) {
      // Add transacao
      const error = await validateDTO(BigqueryOrdemPagamentoDTO, ordemPagamento, false);
      if (Object.keys(error).length > 0) {
        errors.push({
          versao: ordemPagamento.versao,
          error: error,
        });
        continue;
      }
      const transacaoDTO = this.ordemPagamentoToTransacao(ordemPagamento, pagador.id);
      const saveTransacao = await this.saveIfNotExists(transacaoDTO);

      // Add itemTransacao
      const favorecido = await this.clienteFavorecidoService.findCpfCnpj(ordemPagamento.favorecidoCpfCnpj);
      const itemTransacaoDTO = this.ordemPagamentoToItemTransacaoDTO(
        ordemPagamento, saveTransacao.item.id, favorecido);
      await this.itemTransacaoService.saveIfNotExists(itemTransacaoDTO, true);
    }

    // Log errors
    if (errors.length > 0) {
      logWarn(this.logger, `O bigquery retornou itens inválidos, ignorando: ${JSON.stringify(errors)}`, METHOD);
    }
  }

  private async getPagadorFromTarget(target: TransacaoTarget): Promise<Pagador> {
    if (target === 'vanzeiroWeek') {
      return await this.pagadorService.getOneByConta(PagadorContaEnum.JAE);
    } else {
      return await this.pagadorService.getOneByConta(PagadorContaEnum.FASE_4);
    }
  }

  /**
   * Get BigqueryOrdemPagamento depending of target.
   * 
   * For example, if we want Vanzeiros from last week or non-vanzeiros from last day.
   */
  private async getOrdemPagamentoFromTarget(target: TransacaoTarget): Promise<BigqueryOrdemPagamentoDTO[]> {
    // const oldestSaved = await this.itemTransacaoService.getOldestBigqueryDate();
    // if (!oldestSaved) {
    //   if (target === 'vanzeiroWeek') {
    //     // We assume it runs only at Fridays
    //     return await this.bigqueryOrdemPagamentoService.getAll();
    //   } else {
    //     // othersDaily
    //     return await this.bigqueryOrdemPagamentoService.getOthersDay();
    //   }
    // } else
    {
      if (target === 'vanzeiroWeek') {
        return await this.bigqueryOrdemPagamentoService.getVanzeiroWeek(30 * 6);
        // return await this.bigqueryOrdemPagamentoService.getVanzeiroWeekTest();
      } else {
        // othersDaily
        return await this.bigqueryOrdemPagamentoService.getOthersDay();
        // return await this.bigqueryOrdemPagamentoService.getOthersDay();
      }
    }
  }

  private async filterNewOrdemPagamento(ordens: BigqueryOrdemPagamentoDTO[]): Promise<BigqueryOrdemPagamentoDTO[]> {
    const existing = await this.itemTransacaoService.getExistingFromBQOrdemPagamento(ordens);
    const newOrdens = ordens.filter(o =>
      existing.filter(e =>
        e.idOrdemPagamento === o.idOrdemPagamento &&
        e.servico === o.servico &&
        e.idConsorcio === o.idConsorcio &&
        e.idOperadora === o.idOperadora
      ).length === 0
    );
    return newOrdens;
  }


  /**
   * Save Transacao if NSA not exists
   */
  public async saveIfNotExists(dto: TransacaoDTO): Promise<SaveIfNotExists<Transacao>> {
    await validateDTO(TransacaoDTO, dto);
    const transacao = await this.transacaoRepository.findOne({ idOrdemPagamento: asString(dto.idOrdemPagamento) });
    if (transacao) {
      return {
        isNewItem: false,
        item: transacao,
      };
    } else {
      return {
        isNewItem: true,
        item: await this.transacaoRepository.save(dto),
      };
    }
  }

  /**
   * Save Transacao if NSA not exists
   */
  public async save(dto: TransacaoDTO): Promise<Transacao> {
    await validateDTO(TransacaoDTO, dto);
    return await this.transacaoRepository.save(dto);
  }

  /**
   * Para cada BigqueryOrdemPagamento insere em Transacao
   * @returns `id_transacao` do item criado
   */
  public ordemPagamentoToTransacao(ordemPagamento: BigqueryOrdemPagamentoDTO, idPagador: number,
  ): TransacaoDTO {
    const transacao = new TransacaoDTO({
      dataOrdem: asStringDate(ordemPagamento.dataOrdem),
      dataPagamento: asNullableStringDate(ordemPagamento.dataPagamento),
      nomeConsorcio: ordemPagamento.consorcio,
      nomeOperadora: ordemPagamento.operadora,
      idOrdemPagamento: ordemPagamento.idOrdemPagamento,
      servico: ordemPagamento.servico,
      idConsorcio: ordemPagamento.idConsorcio,
      idOperadora: ordemPagamento.idOperadora,
      idOrdemRessarcimento: ordemPagamento.idOrdemRessarcimento,
      quantidadeTransacaoRateioCredito: ordemPagamento.quantidadeTransacaoRateioCredito,
      valorRateioCredito: ordemPagamento.valorRateioCredito,
      quantidadeTransacaoRateioDebito: ordemPagamento.quantidadeTransacaoRateioDebito,
      valorRateioDebito: ordemPagamento.valorRateioDebito,
      quantidadeTotalTransacao: ordemPagamento.quantidadeTotalTransacao,
      valorTotalTransacaoBruto: ordemPagamento.valorTotalTransacaoBruto,
      valorDescontoTaxa: ordemPagamento.valorDescontoTaxa,
      valorTotalTransacaoLiquido: ordemPagamento.valorTotalTransacaoLiquido,
      quantidadeTotalTransacaoCaptura: ordemPagamento.quantidadeTotalTransacaoCaptura,
      valorTotalTransacaoCaptura: ordemPagamento.valorTotalTransacaoCaptura,
      indicadorOrdemValida: ordemPagamento.indicadorOrdemValida,
      pagador: { id: idPagador } as Pagador,
      status: new TransacaoStatus(TransacaoStatusEnum.created),
      versaoOrdemPagamento: ordemPagamento.versao,
    });
    return transacao;
  }

  public ordemPagamentoToItemTransacaoDTO(ordemPagamento: BigqueryOrdemPagamentoDTO, transacaoId: number,
    favorecido: ClienteFavorecido | null): ItemTransacaoDTO {
    const itemTransacao = new ItemTransacaoDTO({
      dataTransacao: asStringDate(ordemPagamento.dataOrdem),
      clienteFavorecido: favorecido ? { id: favorecido.id } : null,
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

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.findAll();
  }

  /**
   * Get all transacao where id not exists in headerArquivo yet (new CNABS)
   */
  public async findAllNewTransacao(): Promise<Transacao[]> {
    return await this.transacaoRepository.findAllNewTransacao();
  }
}