import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoAgrupadoHistorico } from '../entity/ordem-pagamento-agrupado-historico.entity';
import { OrdemPagamentoAgrupadoHistoricoDTO } from '../dto/ordem-pagamento-agrupado-historico.dto';

@Injectable()
export class OrdemPagamentoAgrupadoHistoricoRepository {
  private logger = new CustomLogger(OrdemPagamentoAgrupadoHistoricoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(OrdemPagamentoAgrupadoHistorico)
    private ordemPagamentoAgrupadoHistoricoRepository: Repository<OrdemPagamentoAgrupadoHistorico>,
    private readonly dataSource: DataSource
  ) { }

  public async save(dto: DeepPartial<OrdemPagamentoAgrupadoHistorico>): Promise<OrdemPagamentoAgrupadoHistorico> {
    return await this.ordemPagamentoAgrupadoHistoricoRepository.save(dto);
  }

  public async findOne(fields: EntityCondition<OrdemPagamentoAgrupadoHistorico>): Promise<OrdemPagamentoAgrupadoHistorico[]> {
    return await this.ordemPagamentoAgrupadoHistoricoRepository.find({
      where: fields,
      order: {
        id: 'DESC',
      },
    });
  }

  public async findAll(fields: EntityCondition<OrdemPagamentoAgrupadoHistorico>): Promise<OrdemPagamentoAgrupadoHistorico[]> {
    return await this.ordemPagamentoAgrupadoHistoricoRepository.find({
      where: fields,
    });
  }

  public async getHistoricoDetalheA(detalheAId: number, pagamentoUnico?: boolean): Promise<OrdemPagamentoAgrupadoHistoricoDTO> {

    let query = '';
    if (pagamentoUnico) {
      query = ` select distinct u."fullName" userName, u."cpfCnpj" usercpfcnpj,
                      oph.* from ordem_pagamento_agrupado_historico oph
                      inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
                      left join ordem_pagamento_agrupado opa on opa."id" = oph."ordemPagamentoAgrupadoId"
                      left join ordem_pagamento_unico ou on ou."idOrdemPagamento" = cast(opa.id as varchar)
                      left join public.user u on u."permitCode" = ou."idOperadora" `+          
                ` where da."id" = ${detalheAId} `;
    } else {
      query = (`select distinct u."fullName" userName, u."cpfCnpj" usercpfcnpj,
                      oph.* from ordem_pagamento_agrupado_historico oph 
                      inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id 
                      left join ordem_pagamento_agrupado opa on opa."id" = oph."ordemPagamentoAgrupadoId"
                      left join ordem_pagamento op on op."ordemPagamentoAgrupadoId" = opa.id
                      left join public.user u on u."id" = op."userId"` +
              ` where da."id" = ${detalheAId}`)
    }

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    const result: any[] = await queryRunner.manager.query(query);

    const oph = result.map((i) => new OrdemPagamentoAgrupadoHistoricoDTO(i));

    queryRunner.release()

    return oph[0];
  }

  public async getHistorico(detalheAId: number): Promise<OrdemPagamentoAgrupadoHistorico> {

    const query = (`select distinct 
                    oph.* from ordem_pagamento_agrupado_historico oph 
                    inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id 
                    left join ordem_pagamento_agrupado opa on opa."id" = oph."ordemPagamentoAgrupadoId"
                    left join ordem_pagamento op on op."ordemPagamentoAgrupadoId" = opa.id ` +
      `where da."id" = ${detalheAId}`)

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    const result: any[] = await queryRunner.manager.query(query);

    const oph = result.map((i) => new OrdemPagamentoAgrupadoHistorico(i));

    queryRunner.release()

    return oph[0];
  }

  public async getHistoricoUnico(idOrdemAgrupada: number): Promise<OrdemPagamentoAgrupadoHistorico> {

    const query = (`select distinct 
                    oph.* from ordem_pagamento_agrupado_historico oph                     
                     where oph."ordemPagamentoAgrupadoId" = ${idOrdemAgrupada}`)

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    const result: any[] = await queryRunner.manager.query(query);

    const oph = result.map((i) => new OrdemPagamentoAgrupadoHistorico(i));

    queryRunner.release()

    return oph[0];
  }

}