import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';

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
    let query = ` select opa.* 
                  from ordem_pagamento_agrupado opa
                  inner join ordem_pagamento_agrupado_historico oph on opa.id = oph."ordemPagamentoAgrupadoId 
                  where oph."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico ophh 
                                                where ophh.ordemPagamentoAgrupadoId=opa.id ) `
                  
    if(statusRemessa === undefined || statusRemessa === StatusRemessaEnum.Criado){
      query = query +` and oph."statusRemessa"= 0 and `;
    }else{
      query = query +` and oph."statusRemessa"=${statusRemessa} and`;
    }

    if(dataInicio!==undefined && dataFim!==undefined && 
      (dataFim === dataInicio || new Date(dataFim)>new Date(dataInicio))){
      query = query +` and opa."dataOrdem" between '${dataInicio}' and '${dataFim}' `;
    }else{
      return [];
    }  

    if(nomeConsorcio) {
      query = query +` AND opa."nomeConsorcio" in (${nomeConsorcio}) `;
    }

    this.logger.debug(query);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    return result.map((r) => new OrdemPagamentoAgrupado(r));    
  }
}