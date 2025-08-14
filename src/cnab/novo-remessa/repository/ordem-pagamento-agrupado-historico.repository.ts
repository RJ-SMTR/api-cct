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

  public async getHistoricoDetalheA(
    detalheAId: number,
    pagamentoUnico?: boolean
  ): Promise<OrdemPagamentoAgrupadoHistoricoDTO> {

    const baseQuery = `
    SELECT DISTINCT u."fullName" AS "userName", u."cpfCnpj" AS "usercpfcnpj", oph.*
    FROM ordem_pagamento_agrupado_historico oph
    INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    LEFT JOIN ordem_pagamento_agrupado opa ON opa."id" = oph."ordemPagamentoAgrupadoId"
  `;

    let joinQuery = '';
    if (pagamentoUnico) {
      joinQuery = `
      LEFT JOIN ordem_pagamento_unico ou ON ou."idOrdemPagamento" = CAST(opa.id AS varchar)
      LEFT JOIN public."user" u ON u."permitCode" = ou."idOperadora" `;
    } else {
      joinQuery = `
      LEFT JOIN ordem_pagamento op ON op."ordemPagamentoAgrupadoId" = opa.id
      LEFT JOIN public."user" u ON u."id" = op."userId" `;
    }

    const whereQuery = `WHERE da."id" = $1`;

    const fullQuery = `${baseQuery} ${joinQuery} ${whereQuery}`;

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      const result: any[] = await queryRunner.query(fullQuery, [detalheAId]);
      return new OrdemPagamentoAgrupadoHistoricoDTO(result[0]);
    } finally {
      await queryRunner.release();
    }
  }


  public async getHistorico(detalheAId: number): Promise<OrdemPagamentoAgrupadoHistorico> {

    const query = (`select distinct 
                    oph.* from ordem_pagamento_agrupado_historico oph 
                    inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id 
                    left join ordem_pagamento_agrupado opa on opa."id" = oph."ordemPagamentoAgrupadoId"
                    left join ordem_pagamento op on op."ordemPagamentoAgrupadoId" = opa.id ` +
      `where da."id" = ${detalheAId}`)

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      const result: any[] = await queryRunner.manager.query(query);

      const oph = result.map((i) => new OrdemPagamentoAgrupadoHistorico(i));

      return oph[0];

    } finally {
      await queryRunner.release()
    }
  }

  public async getHistoricoUnico(idOrdemAgrupada: number): Promise<OrdemPagamentoAgrupadoHistorico> {

    const query = (`select distinct 
                    oph.* from ordem_pagamento_agrupado_historico oph                     
                     where oph."ordemPagamentoAgrupadoId" = ${idOrdemAgrupada}`)

    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      const result: any[] = await queryRunner.manager.query(query);

      const oph = result.map((i) => new OrdemPagamentoAgrupadoHistorico(i));

      return oph[0];

    } finally {
      await queryRunner.release()
    }
  }
}