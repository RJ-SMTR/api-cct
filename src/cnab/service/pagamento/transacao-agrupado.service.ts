import { Injectable, Logger } from '@nestjs/common';
import { Transacao } from '../../entity/pagamento/transacao.entity';

import { isFriday, nextFriday } from 'date-fns';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';
import { TransacaoAgrupadoRepository } from 'src/cnab/repository/pagamento/transacao-agrupado.repository';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { asNumber } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DeepPartial, UpdateResult } from 'typeorm';

@Injectable()
export class TransacaoAgrupadoService {
  private logger: Logger = new Logger(TransacaoAgrupadoService.name, {
    timestamp: true,
  });

  constructor(private transacaoAgRepository: TransacaoAgrupadoRepository) {}

  async findOne(fields: EntityCondition<TransacaoAgrupado>) {
    return await this.transacaoAgRepository.findOne(fields);
  }

  async find(fields: EntityCondition<TransacaoAgrupado>) {
    return await this.transacaoAgRepository.findMany({
      where: fields,
    });
  }

  /**
   * **status** is Created.
   *
   * It will automatically update Lancamentos via OneToMany
   *
   * @param newLancamentos It must have at least 1 unused Lancamento
   */
  public generateDTOForLancamento(
    pagador: Pagador,
    newLancamentos: LancamentoEntity[],
  ): Transacao {
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);
    const transacao = new Transacao({
      dataOrdem: friday,
      dataPagamento: null,
      lancamentos: newLancamentos, // unique id for Lancamentos
      pagador: { id: pagador.id } as Pagador,
    });
    return transacao;
  }

  public update(dto: DeepPartial<Transacao>) {
    return this.transacaoAgRepository.update(asNumber(dto.id), dto);
  }

  /**
   * Use first Transacao as set to update and all Transacoes to get ids.
   */
  public updateMany(
    ids: number[],
    set: DeepPartial<TransacaoAgrupado>,
  ): Promise<UpdateResult> {
    return this.transacaoAgRepository.updateMany(ids, set);
  }

  public saveManyIfNotExists(
    transacoes: DeepPartial<Transacao>[],
  ): Promise<TransacaoAgrupado[]> {
    return this.transacaoAgRepository.saveManyIfNotExists(transacoes);
  }

  public async saveMany(
    transacoes: DeepPartial<TransacaoAgrupado>[],
  ): Promise<TransacaoAgrupado[]> {
    const insertResult = await this.transacaoAgRepository.insert(transacoes);
    return await this.transacaoAgRepository.findMany({
      where: insertResult.identifiers,
    });
  }

  /**
   * Save Transacao if NSA not exists
   */
  public async save(
    dto: DeepPartial<TransacaoAgrupado>,
  ): Promise<TransacaoAgrupado> {
    return await this.transacaoAgRepository.save(dto);
  }

  public async getAll(): Promise<TransacaoAgrupado[]> {
    return await this.transacaoAgRepository.findAll();
  }

  /**
   * Get all transacao where id not exists in headerArquivo yet (new CNABS)
   */
  public async findAllNewTransacao(
    tipo: PagadorContaEnum,
  ): Promise<TransacaoAgrupado[]> {
    return await this.transacaoAgRepository.findAllNewTransacao(tipo);
  }
}
