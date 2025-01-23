import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { formatDateISODate } from 'src/utils/date-utils';

@Injectable()
export class OrdemPagamentoAgrupadoRepository {
  private logger = new CustomLogger(OrdemPagamentoAgrupadoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamentoAgrupado)    
    private ordemPagamentoAgrupadoRepository: Repository<OrdemPagamentoAgrupado>,
    private readonly dataSource: DataSource,
  ) {}

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

  public async findAll(): Promise<OrdemPagamentoAgrupado[]> {
    return await this.ordemPagamentoAgrupadoRepository.find({});
  }

  public async findAllCustom(dataInicio:Date,dataFim:Date,nomeConsorcio?:string[],statusRemessa?:StatusRemessaEnum): Promise<OrdemPagamentoAgrupado[]> {
    const dataIniForm = formatDateISODate(dataInicio)
    const dataFimForm = formatDateISODate(dataFim)
    let query = ` select distinct opa.* from ordem_pagamento op
					        inner join ordem_pagamento_agrupado opa on opa.id = op."ordemPagamentoAgrupadoId"
							    inner join ordem_pagamento_agrupado_historico oph on opa.id = oph."ordemPagamentoAgrupadoId"
							                            and oph."dataReferencia" =
                                          (select max(ophh."dataReferencia") from ordem_pagamento_agrupado_historico ophh
					                                where ophh."ordemPagamentoAgrupadoId"=op."ordemPagamentoAgrupadoId") 
                  where (1=1) `
                  
    if(statusRemessa === undefined || statusRemessa === StatusRemessaEnum.Criado){
      query = query +` and oph."statusRemessa"= 1 `;
    }else{
      query = query +` and oph."statusRemessa"=${statusRemessa} `;
    }

    if(dataInicio!==undefined && dataFim!==undefined && dataFim >=dataInicio){
      query = query +` and op."dataOrdem" between '${dataIniForm}' and '${dataFimForm}' `;
    }else{
      return [];
    }  

    if(nomeConsorcio) {
      query = query +` and op."nomeConsorcio" in ('${nomeConsorcio.join("','")}') `;
    }

    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    return result.map((r) => new OrdemPagamentoAgrupado(r));    
  }
}