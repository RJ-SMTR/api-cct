import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, In, Repository } from 'typeorm';
import { OrdemPagamentoAgrupado } from '../domain/entity/ordem-pagamento-agrupado.entity';
import { StatusRemessaEnum } from 'src/domain/enum/status-remessa.enum';
import { formatDateISODate } from 'src/utils/date-utils';

@Injectable()
export class OrdemPagamentoAgrupadoRepository {

  private logger = new CustomLogger(OrdemPagamentoAgrupadoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamentoAgrupado)
    private ordemPagamentoAgrupadoRepository: Repository<OrdemPagamentoAgrupado>,
    private readonly dataSource: DataSource,
  ) { }

  public async save(dto: DeepPartial<OrdemPagamentoAgrupado>): Promise<OrdemPagamentoAgrupado> {
    return this.ordemPagamentoAgrupadoRepository.save(dto);
  }

  public async saveAll(dtos: DeepPartial<OrdemPagamentoAgrupado>[]): Promise<OrdemPagamentoAgrupado[]> {
    return this.ordemPagamentoAgrupadoRepository.save(dtos);
  }

  public async findOne(fields: EntityCondition<OrdemPagamentoAgrupado>): Promise<Nullable<OrdemPagamentoAgrupado>> {
    return await this.ordemPagamentoAgrupadoRepository.findOne({
      where: fields,
    });
  }
  public async findOnePai(fields: EntityCondition<OrdemPagamentoAgrupado>): Promise<Nullable<OrdemPagamentoAgrupado>> {
    return await this.ordemPagamentoAgrupadoRepository.findOne({
      where: fields,
      relations: ['ordensPagamentoAgrupadoHistorico'], 
    });
  }

  public async findAll(): Promise<OrdemPagamentoAgrupado[]> {
    return await this.ordemPagamentoAgrupadoRepository.find({});
  }

  

  public async findParent(dataPagamento?: Date) {
    let queryPai = `
    select distinct opa.* from ordem_pagamento_agrupado opa
							    inner join ordem_pagamento_agrupado_historico oph on opa.id = oph."ordemPagamentoAgrupadoId"
                  where oph."statusRemessa" = 0
                  and EXISTS (
                  SELECT 1 from ordem_pagamento_agrupado 
                    where "ordemPagamentoAgrupadoId" = opa.id
                  )
    `
    if (dataPagamento) {
      const dataPagamentoForm = formatDateISODate(dataPagamento)
      queryPai = queryPai + `and "dataPagamento" ='${dataPagamentoForm}'`

    }
    const queryRunnerPai = this.dataSource.createQueryRunner();
    await queryRunnerPai.connect();
    const resultPai: any[] = await queryRunnerPai.query(queryPai);
    return resultPai.map(r => new OrdemPagamentoAgrupado(r))
  }



  public async findAllPendente(
    dataInicio: Date,
    dataFim: Date,
    nomeConsorcio?: string[],
    dataPagamento?: Date,
    idOperadoras?: string[]
  ): Promise<OrdemPagamentoAgrupado[]> {
    const dataIniForm = formatDateISODate(dataInicio);
    const dataFimForm = formatDateISODate(dataFim);

    const paiResult = await this.findParent(dataPagamento);
    let result: OrdemPagamentoAgrupado[] = [...paiResult];

    const queryRunnerChild = this.dataSource.createQueryRunner();
    await queryRunnerChild.connect();

    let query = `SELECT DISTINCT opa.* 
               FROM ordem_pagamento_agrupado opa
               INNER JOIN ordem_pagamento op ON opa.id = op."ordemPagamentoAgrupadoId"
               INNER JOIN ordem_pagamento_agrupado_historico oph ON opa.id = oph."ordemPagamentoAgrupadoId"
               WHERE oph."statusRemessa" = 0`;

    if (dataPagamento) {
      const dataPagamentoForm = formatDateISODate(dataPagamento);
      query += ` AND opa."dataPagamento" = '${dataPagamentoForm}'`;
    }

    if (dataInicio && dataFim && dataFim >= dataInicio) {
      query += ` AND op."dataCaptura" BETWEEN '${dataIniForm} 00:00:00' AND '${dataFimForm} 23:59:59'`;
    } else {
      await queryRunnerChild.release();
      return result;
    }

    if (nomeConsorcio && nomeConsorcio.length) {
      query += ` AND op."nomeConsorcio" IN ('${nomeConsorcio.join("','")}')`;
    }
    if(idOperadoras && idOperadoras.length){
      query += ` AND op."idOperadora" IN ('${idOperadoras.join("','")}')`;
    }

    this.logger.debug(query);

    const childRows: any[] = await queryRunnerChild.query(query);
    await queryRunnerChild.release();

    const childResult = childRows.map(r => new OrdemPagamentoAgrupado(r));

    result = [...result, ...childResult];

    return result;
  }

  
  public async findAllCustom(dataInicio: Date, dataFim: Date, nomeConsorcio?: string[], dataPagamento?: Date): Promise<OrdemPagamentoAgrupado[]> {
    const dataIniForm = formatDateISODate(dataInicio)
    const dataFimForm = formatDateISODate(dataFim)

    let query = ` select distinct opa.* from ordem_pagamento op
					        inner join ordem_pagamento_agrupado opa on opa.id = op."ordemPagamentoAgrupadoId"
							    inner join ordem_pagamento_agrupado_historico oph on opa.id = oph."ordemPagamentoAgrupadoId"
                  where oph."statusRemessa"= 0 
                  `;
    if (dataPagamento) {
      const dataPagamentoForm = formatDateISODate(dataPagamento)
      query = query + `and "dataPagamento" ='${dataPagamentoForm}'`
    }

    if (dataInicio !== undefined && dataFim !== undefined && dataFim >= dataInicio) {
      query = query + ` and op."dataCaptura" between '${dataIniForm} 00:00:00' and '${dataFimForm} 23:59:59' 
       and op."ordemPagamentoAgrupadoId" is not null `;
    } else {
      return [];
    }

    if (nomeConsorcio) {
      query = query + ` and op."nomeConsorcio" in ('${nomeConsorcio.join("','")}') `;
    }

    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(query);
    queryRunner.release();
    return result.map((r) => new OrdemPagamentoAgrupado(r));
  }

  public async findAllUnica(dataInicio: Date, dataFim: Date, dataPgto: Date, statusRemessa?: StatusRemessaEnum): Promise<OrdemPagamentoAgrupado[]> {
    const dataIniForm = formatDateISODate(dataInicio)
    const dataFimForm = formatDateISODate(dataFim)
    const dataPgtoForm = formatDateISODate(dataPgto)
    let query = ` select distinct opa.* from ordem_pagamento_unico op
					        inner join ordem_pagamento_agrupado opa on cast(opa.id as varchar) = op."idOrdemPagamento" 
							    inner join ordem_pagamento_agrupado_historico oph on opa.id = oph."ordemPagamentoAgrupadoId"
							                            and oph."dataReferencia" =
                                          (select max(ophh."dataReferencia") from ordem_pagamento_agrupado_historico ophh
					                                where cast(ophh."ordemPagamentoAgrupadoId" as varchar)=op."idOrdemPagamento") 
                  where (oph."dataReferencia"='${dataPgtoForm}') `

    if (statusRemessa === undefined || statusRemessa === StatusRemessaEnum.Criado) {
      query = query + ` and oph."statusRemessa"= 0 `;
    } else {
      query = query + ` and oph."statusRemessa"=${statusRemessa} `;
    }

    if (dataInicio !== undefined && dataFim !== undefined && dataFim >= dataInicio) {
      query = query + ` and cast(op."dataOrdem" as Date) between '${dataIniForm} ' and '${dataFimForm}' `;
    } else {
      return [];
    }

    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(query);
    queryRunner.release();
    return result.map((r) => new OrdemPagamentoAgrupado(r));
  }

  async excluirPorIds(ids: string) {
    const query = ` delete from ordem_pagamento_agrupado 
            where id in('${ids}') `;

    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      this.logger.debug(query);
      await queryRunner.query(query);
    } finally {
      queryRunner.release();
    }
  }
}
