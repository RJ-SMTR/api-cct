
import { Injectable, Logger } from '@nestjs/common';
import { asNullableStringDate, asStringDate } from 'src/utils/pipe-utils';
import { TransacaoDTO } from '../../dto/pagamento/transacao.dto';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { TransacaoRepository } from '../../repository/pagamento/transacao.repository';

import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { AllPagadorDict } from 'src/cnab/interfaces/pagamento/all-pagador-dict.interface';
import { PermissionarioRoleEnum } from 'src/permissionario-role/permissionario-role.enum';
import { filterArrayInANotInB } from 'src/utils/array-utils';
import { SaveManyNew } from 'src/utils/interfaces/save-many-new.interface';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { In } from 'typeorm';
import { Pagador } from '../../entity/pagamento/pagador.entity';
import { TransacaoStatus } from '../../entity/pagamento/transacao-status.entity';
import { TransacaoStatusEnum } from '../../enums/pagamento/transacao-status.enum';

@Injectable()
export class TransacaoService {
  private logger: Logger = new Logger('TransacaoService', {
    timestamp: true,
  });

  constructor(
    private transacaoRepository: TransacaoRepository,
  ) { }

  /**
   * Bulk save Transacao if NSA not exists
   */
  public async saveManyNewFromOrdem(
    ordens: BigqueryOrdemPagamentoDTO[],
    pagadores: AllPagadorDict,
  ): Promise<SaveManyNew<Transacao>> {
    const uniqueIdOrdens: string[] = [...new Set(ordens.reduce((l, i) => [...l, i.idOrdemPagamento], []))];
    const existingItems = await this.transacaoRepository.findMany({ where: { idOrdemPagamento: In(uniqueIdOrdens) } });
    const existingIdOrdens = existingItems.reduce((l, i) => [...l, i.idOrdemPagamento], []);
    const notExistingIdOrdens = filterArrayInANotInB(uniqueIdOrdens, existingIdOrdens);
    const notExistingIdOrdensAux = structuredClone(notExistingIdOrdens);
    const newTransacoes: TransacaoDTO[] = [];
    for (const ordem of ordens) {
      if (notExistingIdOrdensAux.length === 0) {
        break;
      }
      if (notExistingIdOrdensAux.includes(ordem.idOrdemPagamento)) {
        const pagador = ordem.permissionarioRole === PermissionarioRoleEnum.vanzeiro
          ? pagadores.jae : pagadores.lancamento;
        newTransacoes.push(this.ordemPagamentoToTransacao(ordem, pagador.id));
        notExistingIdOrdensAux.splice(notExistingIdOrdensAux.indexOf(ordem.idOrdemPagamento), 1);
      }
    }
    const insertResult = await this.transacaoRepository.insert(newTransacoes);
    const insertedTransacoes = await this.transacaoRepository.findMany({
      where: insertResult.identifiers as { id: number }[]
    })
    return {
      existing: existingItems,
      inserted: insertedTransacoes,
    }
  }

  /**
   * Para cada BigqueryOrdemPagamento insere em Transacao
   * 
   * **status** is Created.
   * 
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

  /**
   * Save Transacao if NSA not exists
   */
  public async saveIfNotExists(dto: TransacaoDTO): Promise<SaveIfNotExists<Transacao>> {
    return await this.transacaoRepository.saveDTOIfNotExists(dto);
  }

  /**
   * Save Transacao if NSA not exists
   */
  public async save(dto: TransacaoDTO): Promise<Transacao> {
    await validateDTO(TransacaoDTO, dto);
    return await this.transacaoRepository.save(dto);
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