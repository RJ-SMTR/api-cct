import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { formatDateISODate } from 'src/utils/date-utils';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { OrdemPagamentoAgrupadoHistorico } from '../entity/ordem-pagamento-agrupado-historico.entity';
import { OrdemPagamentoAgrupadoHistoricoDTO } from '../dto/ordem-pagamento-agrupado-historico.dto';

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

  public async findAllCustom(dataInicio:Date,dataFim:Date,dataPgto:Date,nomeConsorcio?:string[],statusRemessa?:StatusRemessaEnum): Promise<OrdemPagamentoAgrupado[]> {
    const dataIniForm = formatDateISODate(dataInicio)
    const dataFimForm = formatDateISODate(dataFim)
    const dataPgtoForm = formatDateISODate(dataPgto)
    let query = ` select distinct opa.* from ordem_pagamento op
					        inner join ordem_pagamento_agrupado opa on opa.id = op."ordemPagamentoAgrupadoId"
							    inner join ordem_pagamento_agrupado_historico oph on opa.id = oph."ordemPagamentoAgrupadoId"
							                            and oph."dataReferencia" =
                                          (select max(ophh."dataReferencia") from ordem_pagamento_agrupado_historico ophh
					                                where ophh."ordemPagamentoAgrupadoId"=op."ordemPagamentoAgrupadoId") 
                  where (oph."dataReferencia"='${dataPgtoForm}') `
                  
    if(statusRemessa === undefined || statusRemessa === StatusRemessaEnum.Criado){
      query = query +` and oph."statusRemessa"= 0 `;
    }else{
      query = query +` and oph."statusRemessa"=${statusRemessa} `;
    }

    if(dataInicio!==undefined && dataFim!==undefined && dataFim >=dataInicio){
      query = query +` and op."dataCaptura" between '${dataIniForm} 00:00:00' and '${dataFimForm} 23:59:59' 
       and op."ordemPagamentoAgrupadoId" is not null `;
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


  public async findAllUnica(dataInicio:Date,dataFim:Date,dataPgto:Date,statusRemessa?:StatusRemessaEnum): Promise<OrdemPagamentoAgrupado[]> {
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
                  
    if(statusRemessa === undefined || statusRemessa === StatusRemessaEnum.Criado){
      query = query +` and oph."statusRemessa"= 0 `;
    }else{
      query = query +` and oph."statusRemessa"=${statusRemessa} `;
    }

    if(dataInicio!==undefined && dataFim!==undefined && dataFim >=dataInicio){
      query = query +` and cast(op."dataOrdem" as Date) between '${dataIniForm} ' and '${dataFimForm}' `;
    }else{
      return [];
    }      

    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    return result.map((r) => new OrdemPagamentoAgrupado(r));    
  }
}