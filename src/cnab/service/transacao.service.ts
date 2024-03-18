
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
import { logError } from 'src/utils/log-utils';
import { InvalidRows } from 'src/utils/types/invalid-rows.type';
import { validateDTO } from 'src/utils/validation-utils';
import { Pagador } from '../entity/pagador.entity';
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

  public async updateTransacaoFromJae() {
    const METHOD = 'updateTransacaoFromJae()';
    // Update cliente favorecido
    await this.clienteFavorecidoService.updateAllFromUsers();

    // Update transacao
    const ordensPagamento = this.bigqueryOrdemPagamentoService.getCurrentWeekTest();
    const pagador = await this.pagadorService.getOneByConta(PagadorContaEnum.JAE);
    const errors: InvalidRows[] = [];

    for (const ordemPagamento of ordensPagamento) {
      // Add transacao
      const error = await validateDTO(BigqueryOrdemPagamentoDTO, ordemPagamento, false);
      if (Object.keys(error).length > 0) {
        errors.push(error);
        continue;
      }
      const transacaoDTO = this.ordemPagamentoToTransacao(ordemPagamento, pagador.id);
      const saveTransacaoDTO = await this.saveIfNotExists(transacaoDTO);

      // Add itemTransacao
      const favorecido = await this.clienteFavorecidoService.getCpfCnpj(ordemPagamento.aux_favorecidoCpfCnpj);
      const itemTransacaoDTO = this.ordemPagamentoToItemTransacaoDTO(ordemPagamento,
        saveTransacaoDTO.id, favorecido.id)
      await this.itemTransacaoService.saveIfNotExists(itemTransacaoDTO);
    }

    // Log errors
    if (errors.length > 0) {
      logError(this.logger, `O bigquery retornou itens inválidos: ${JSON.stringify(errors)}`, METHOD);
    }
  }


  /**
   * Save
   */
  public async saveIfNotExists(dto: TransacaoDTO): Promise<Transacao> {
    const transacao = await this.transacaoRepository.findOne({ idOrdemPagamento: asString(dto.idOrdemPagamento) });
    if (transacao) {
      return transacao;
    } else {
      return await this.transacaoRepository.save(dto);
    }
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
      servico: ordemPagamento.servico,
      idOrdemPagamento: asString(ordemPagamento.idOrdemPagamento),
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
    });
    return transacao;
  }

  public ordemPagamentoToItemTransacaoDTO(ordemPagamento: BigqueryOrdemPagamentoDTO, transacaoId: number,
    favorecidoId: number): ItemTransacaoDTO {
    const itemTransacao = new ItemTransacaoDTO({
      dataTransacao: asStringDate(ordemPagamento.dataOrdem),
      clienteFavorecido: { id: favorecidoId },
      transacao: { id: transacaoId },
      valor: ordemPagamento.valorTotalTransacaoLiquido,
      // Composite unique columns
      idOrdemPagamento: ordemPagamento.idOrdemPagamento,
      idConsorcio: ordemPagamento.idConsorcio,
      idOperadora: ordemPagamento.idOperadora,
      servico: ordemPagamento.servico,
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