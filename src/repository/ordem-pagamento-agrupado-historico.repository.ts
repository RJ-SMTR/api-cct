import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoAgrupadoHistorico } from '../domain/entity/ordem-pagamento-agrupado-historico.entity';
import { OrdemPagamentoAgrupadoHistoricoDTO } from '../domain/dto/ordem-pagamento-agrupado-historico.dto';
import { OrdemPagamento } from '../domain/entity/ordem-pagamento.entity';

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

  public async getHistoricoDetalheA(detalheAId: number, pagamentoUnico?: boolean, isPendente?: boolean): Promise<OrdemPagamentoAgrupadoHistoricoDTO> {

    let query = '';
    if (pagamentoUnico) {
      query = ` select distinct u."fullName" userName, u."cpfCnpj" usercpfcnpj,
                      oph.* from ordem_pagamento_agrupado_historico oph
                      inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
                      left join ordem_pagamento_agrupado opa on opa."id" = oph."ordemPagamentoAgrupadoId"
                      left join ordem_pagamento_unico ou on ou."idOrdemPagamento" = cast(opa.id as varchar)
                      left join public.user u on u."permitCode" = ou."idOperadora" `+          
                ` where da."id" = ${detalheAId} `;
    } else if(isPendente){
      query = (`select distinct u."fullName" userName, u."cpfCnpj" usercpfcnpj,
                      oph.* from ordem_pagamento_agrupado_historico oph
    INNER JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    LEFT JOIN ordem_pagamento_agrupado opa ON opa."id" = oph."ordemPagamentoAgrupadoId"
    LEFT JOIN LATERAL (
        SELECT *
        FROM ordem_pagamento_agrupado
        WHERE
            "ordemPagamentoAgrupadoId" = opa.id
    ) filhos ON true
    LEFT JOIN LATERAL (
        SELECT *
        FROM ordem_pagamento op2
        WHERE
            op2."ordemPagamentoAgrupadoId" = COALESCE(filhos.id, opa.id)
    ) op ON true
    LEFT JOIN public.user u ON u."id" = op."userId"` +
    `where da."id" = ${detalheAId}`)
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

  public async getHistorico(detalheAId: number): Promise<OrdemPagamentoAgrupadoHistorico[]> {

    const query = (`WITH raiz AS (
    SELECT opa.id
    FROM ordem_pagamento_agrupado opa
    left JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = opa.id
    left JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
    WHERE da.id = ${detalheAId}
),
filhos AS (
    SELECT id
    FROM ordem_pagamento_agrupado
    WHERE "ordemPagamentoAgrupadoId" IN (SELECT id FROM raiz)
)
SELECT DISTINCT oph.*
FROM ordem_pagamento_agrupado_historico oph
left JOIN detalhe_a da 
    ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
WHERE da.id = ${detalheAId}
   OR oph."ordemPagamentoAgrupadoId" IN (SELECT id FROM filhos)
   and oph."statusRemessa" NOT IN (4,3)
`)

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    const result: any[] = await queryRunner.manager.query(query);

    const oph = result.map((i) => new OrdemPagamentoAgrupadoHistorico(i));

    queryRunner.release()

    return oph.length ? oph : [];
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

  async excluirHistorico(ids: string) {   

    const query = (`delete from ordem_pagamento_agrupado_historico oph
      where oph."ordemPagamentoAgrupadoId" in ('${ids}')`)

    const queryRunner = this.dataSource.createQueryRunner();

    queryRunner.connect();

    await queryRunner.manager.query(query);   

    queryRunner.release()
  }

}