import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DataSource, DeepPartial, Repository } from 'typeorm';
import { OrdemPagamentoAgrupadoHistorico } from '../entity/ordem-pagamento-agrupado-historico.entity';
import { OrdemPagamentoAgrupadoHistoricoDTO } from '../dto/ordem-pagamento-agrupado-historico.dto';
import { OrdemPagamento } from '../entity/ordem-pagamento.entity';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';

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

  public async getHistoricoDetalheA(detalheAId: number, pagamentoUnico?: boolean, isPendente?: boolean,consorcios?: string[]): Promise<OrdemPagamentoAgrupadoHistoricoDTO> {

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
      // resolve o usuario pela ordem "filha" (consorcio OU guardador), ou pela
      // propria opa se ela nao for pai
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
        SELECT op2."userId"
        FROM ordem_pagamento op2
        WHERE op2."ordemPagamentoAgrupadoId" = COALESCE(filhos.id, opa.id)
        UNION ALL
        SELECT og2."userId"
        FROM ordem_pagamento_guardador og2
        WHERE og2."ordemPagamentoAgrupadoId" = COALESCE(filhos.id, opa.id)
    ) op ON true
    LEFT JOIN public.user u ON u."id" = op."userId"` +
    `where da."id" = ${detalheAId}`)
    } else {
      if(consorcios && consorcios.length > 0){
          query = (`select distinct u."fullName" userName, u."cpfCnpj" usercpfcnpj,
                          oph.* from ordem_pagamento_agrupado_historico oph 
                          inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id 
                          left join ordem_pagamento_agrupado opa on opa."id" = oph."ordemPagamentoAgrupadoId"
                          left join ordem_pagamento op on op."ordemPagamentoAgrupadoId" = opa.id
                          left join public.user u on u."id" = op."userId"` +
            ` where da."id" = ${detalheAId}`)
        }else{
          query = (`select distinct u."fullName" userName, u."cpfCnpj" usercpfcnpj,
                        oph.* from ordem_pagamento_agrupado_historico oph 
                        inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id 
                        left join ordem_pagamento_agrupado opa on opa."id" = oph."ordemPagamentoAgrupadoId"
                        left join ordem_pagamento_guardador op on op."ordemPagamentoAgrupadoId" = opa.id
                        left join public.user u on u."id" = op."userId"` +
          ` where da."id" = ${detalheAId}`)
        }
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

  /**
   * Retorno de pendentes (consórcios e guardador): quando a ordem de pagamento
   * agrupada "pai" (agrupamento de pendentes) tem seu retorno resolvido, o
   * resultado cobre também as ordens "filhas". O relatório lê o histórico das
   * filhas, então o status precisa ser propagado nos dois desfechos:
   *
   *  - pai Efetivado/PendenciaPaga (3/5) -> filhas viram PendenciaPaga (5),
   *    inclusive as que já estão Efetivado (3);
   *  - pai NaoEfetivado (4) -> filhas viram NaoEfetivado (4) com o mesmo
   *    motivoStatusRemessa do pai (a tentativa falhou de novo).
   *
   * Se a pai ainda não foi resolvida (Criado/PreparadoParaEnvio/AguardandoPagamento),
   * nada é alterado - ainda não há o que propagar.
   *
   * @returns quantidade de históricos de ordens filhas atualizados
   */
  public async propagarPagamentoPaiParaFilhas(detalheAId: number): Promise<number> {
    const query = `
      WITH pai AS (
        SELECT oph."ordemPagamentoAgrupadoId" AS opa_id, oph."statusRemessa" AS status,
               oph."motivoStatusRemessa" AS motivo
        FROM detalhe_a da
        JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
        WHERE da.id = $1
      ),
      alvo AS (
        SELECT opa_id, motivo,
          CASE
            WHEN status IN (${StatusRemessaEnum.Efetivado}, ${StatusRemessaEnum.PendenciaPaga}) THEN ${StatusRemessaEnum.PendenciaPaga}
            WHEN status = ${StatusRemessaEnum.NaoEfetivado} THEN ${StatusRemessaEnum.NaoEfetivado}
          END AS status_alvo
        FROM pai
      ),
      filhas AS (
        SELECT opa.id AS opa_id
        FROM ordem_pagamento_agrupado opa
        WHERE opa."ordemPagamentoAgrupadoId" = (SELECT opa_id FROM alvo)
      )
      UPDATE ordem_pagamento_agrupado_historico oph
      SET "statusRemessa" = (SELECT status_alvo FROM alvo),
          "motivoStatusRemessa" = CASE
            WHEN (SELECT status_alvo FROM alvo) = ${StatusRemessaEnum.NaoEfetivado} THEN (SELECT motivo FROM alvo)
            ELSE oph."motivoStatusRemessa"
          END,
          "dataReferencia" = now()
      WHERE oph."ordemPagamentoAgrupadoId" IN (SELECT opa_id FROM filhas)
        AND (SELECT status_alvo FROM alvo) IS NOT NULL
        AND oph."statusRemessa" <> (SELECT status_alvo FROM alvo)
      RETURNING oph.id
    `;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // useStructuredResult=true => { records, affected, raw }
      const result: any = await queryRunner.query(query, [detalheAId], true);
      if (Array.isArray(result?.records)) {
        return result.records.length;
      }
      return typeof result?.affected === 'number' ? result.affected : 0;
    } finally {
      await queryRunner.release();
    }
  }

}