import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { IFindPublicacaoRelatorioNovoRemessa } from './interfaces/find-publicacao-relatorio-novo-remessa.interface';
import {
  RelatorioConsolidadoNovoRemessaData,
  RelatorioConsolidadoNovoRemessaDto,
} from './dtos/relatorio-consolidado-novo-remessa.dto';
import { formatDateISODate } from 'src/utils/date-utils';


@Injectable()
export class RelatorioNovoRemessaRepository {
  
  private static readonly QUERY_FROM = ` from ordem_pagamento op 
                    inner join ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId"=opa.id
                    inner join ordem_pagamento_agrupado_historico oph on oph."ordemPagamentoAgrupadoId"=opa.id
                    inner join detalhe_a da on da."ordemPagamentoAgrupadoHistoricoId"= oph.id
                    inner join public."user" uu on uu."id"=op."userId" 
                    where (1=1) `;                    


  private static readonly QUERY_CONSOLIDADO_VANZEIROS = `
      WITH latest_opah AS (
          SELECT DISTINCT ON (opah."ordemPagamentoAgrupadoId")
              opah."ordemPagamentoAgrupadoId",
              opah.id AS "opahId",
              opah."dataReferencia",
              opah."statusRemessa",
              opah."motivoStatusRemessa",
              opah."userBankCode",
              opah."userBankAgency",
              opah."userBankAccount",
              opah."userBankAccountDigit"
          FROM ordem_pagamento_agrupado_historico opah
          ORDER BY opah."ordemPagamentoAgrupadoId", opah."dataReferencia" DESC
      )
      SELECT
          op."userId",
          u."fullName",
          COALESCE(da."valorLancamento", SUM(op.valor)) AS "valorTotal"
      FROM ordem_pagamento op
               JOIN ordem_pagamento_agrupado opa
                    ON op."ordemPagamentoAgrupadoId" = opa.id
               JOIN latest_opah l
                    ON l."ordemPagamentoAgrupadoId" = opa.id
               JOIN "user" u
                    ON u.id = op."userId"
               LEFT JOIN detalhe_a da
                         ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
      WHERE 1 = 1
        AND (op."userId" = ANY($1) OR $1 IS NULL)
        AND (
          (
              (date_trunc('day', op."dataCaptura") BETWEEN $2 AND $3 OR $2 IS NULL OR $3 IS NULL)
                  AND l."statusRemessa" NOT IN (2, 3, 4)
              )
              OR
          (
              (date_trunc('day', da."dataVencimento") BETWEEN $2 AND $3 OR $2 IS NULL OR $3 IS NULL)
                  AND l."statusRemessa" IN (2, 3, 4)
              )
          )

          /* statusRemessa array filter */
        AND (
            l."statusRemessa" = ANY($4)
            OR (l."statusRemessa" IS NULL AND 1 = ANY($4))
            OR $4 IS NULL
        )

          /* Exclude certain CPF/CNPJ */
        AND u."cpfCnpj" NOT IN (
                                '18201378000119',
                                '12464869000176',
                                '12464539000180',
                                '12464553000184',
                                '44520687000161',
                                '12464577000133'
          )
      GROUP BY
          op."userId",
          u."fullName",
          da."valorLancamento"
      HAVING
          (SUM(op.valor) >= $5 OR $5 IS NULL)
         AND (SUM(op.valor) <= $6 OR $6 IS NULL)
      ORDER BY
          u."fullName";

  `;

  private static readonly QUERY_CONSOLIDADO_CONSORCIOS = `
      WITH latest_opah AS (
          SELECT DISTINCT ON (opah."ordemPagamentoAgrupadoId")
              opah."ordemPagamentoAgrupadoId" AS "opaId",
              opah.id                         AS "opahId",
              opah."dataReferencia",
              opah."statusRemessa",
              opah."motivoStatusRemessa",
              opah."userBankCode",
              opah."userBankAgency",
              opah."userBankAccount",
              opah."userBankAccountDigit"
          FROM ordem_pagamento_agrupado_historico opah
          ORDER BY opah."ordemPagamentoAgrupadoId", opah."dataReferencia" DESC
      ),

           valid_aggregators AS (
               SELECT DISTINCT op."ordemPagamentoAgrupadoId" AS "opaId"
               FROM ordem_pagamento op
                        JOIN latest_opah l
                             ON l."opaId" = op."ordemPagamentoAgrupadoId"
                        LEFT JOIN detalhe_a da
                                  ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
               WHERE
                   (
                       (
                           (date_trunc('day', op."dataCaptura") BETWEEN $1 AND $2 OR $1 IS NULL OR $2 IS NULL)
                               AND l."statusRemessa" NOT IN (2, 3, 4)
                           )
                           OR
                       (
                           (date_trunc('day', da."dataVencimento") BETWEEN $1 AND $2 OR $1 IS NULL OR $2 IS NULL)
                               AND l."statusRemessa" IN (2, 3, 4)
                           )
                       )
                 AND (
                       l."statusRemessa" = ANY($3)
                       OR (l."statusRemessa" IS NULL AND 1 = ANY($3))
                       OR $3 IS NULL
                   )
           ),

           not_tec AS (
               SELECT
                   sub."fullName",
                   SUM(COALESCE(da."valorLancamento", sub.sum_valor)) AS "valorTotal"
               FROM (
                        SELECT
                            op."ordemPagamentoAgrupadoId" AS "opaId",
                            op."nomeConsorcio"           AS "fullName",
                            SUM(op.valor)                AS sum_valor
                        FROM ordem_pagamento op
                                 JOIN "user" u ON u.id = op."userId"
                        WHERE op."nomeConsorcio" NOT IN ('STPC', 'STPL', 'TEC')
                        GROUP BY op."ordemPagamentoAgrupadoId", op."nomeConsorcio"
                    ) sub
                        JOIN valid_aggregators va
                             ON va."opaId" = sub."opaId"
                        JOIN ordem_pagamento_agrupado opa
                             ON opa.id = sub."opaId"
                        JOIN latest_opah l
                             ON l."opaId" = opa.id
                        LEFT JOIN detalhe_a da
                                  ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
               WHERE
                   (
                       TRIM(UPPER(sub."fullName")) = ANY($4)
                           OR $4 IS NULL
                       )
               GROUP BY sub."fullName"
               HAVING
                   (SUM(COALESCE(da."valorLancamento", sub.sum_valor)) >= $5 OR $5 IS NULL)
                  AND
                   (SUM(COALESCE(da."valorLancamento", sub.sum_valor)) <= $6 OR $6 IS NULL)
           ),

           tec AS (
               SELECT SUM("valorTotal") AS "valorTotal", "fullName"
                   FROM (
                            SELECT distinct
                                op."nomeConsorcio" AS "fullName",
                                COALESCE(da."valorLancamento", opa."valorTotal") AS "valorTotal",
                                opa.id AS "ordemPagamentoAgrupadoId"
                            FROM ordem_pagamento op
                                     JOIN valid_aggregators va
                                          ON va."opaId" = op."ordemPagamentoAgrupadoId"
                                     JOIN "user" u
                                          ON op."userId" = u.id
                                     JOIN ordem_pagamento_agrupado opa
                                          ON op."ordemPagamentoAgrupadoId" = opa.id
                                     JOIN latest_opah l
                                          ON l."opaId" = opa.id
                                     LEFT JOIN detalhe_a da
                                               ON da."ordemPagamentoAgrupadoHistoricoId" = l."opahId"
                            WHERE
                                op."nomeConsorcio" IN ('STPC', 'STPL', 'TEC')
                              AND (
                                TRIM(UPPER(op."nomeConsorcio")) = ANY($4)
                                    OR $4 IS NULL
                                )
                              AND
                                ( (COALESCE(da."valorLancamento", opa."valorTotal") >= $5 OR $5 IS NULL)
                                      AND
                                  COALESCE(da."valorLancamento", opa."valorTotal") <= $6 OR $6 IS NULL)
                   ) aux  
                   GROUP BY "fullName"
           )

      SELECT "fullName", "valorTotal"
      FROM not_tec
      UNION
      SELECT "fullName", "valorTotal"
      FROM tec
      ORDER BY "fullName";
  `;

  private static readonly QUERY_SINTETICO = `
    select op."userId", u."fullName", op.valor,
       CASE opah."statusRemessa"
              WHEN 3 THEN 'pago'
              WHEN 4 THEN 'naopago'
              ELSE 'apagar'
         END as status,
         opah."motivoStatusRemessa"
    from ordem_pagamento op
         inner join public.ordem_pagamento_agrupado opa on op."ordemPagamentoAgrupadoId" = opa.id
         join lateral (
    select opah."dataReferencia",
           opah."statusRemessa",
           opah."motivoStatusRemessa",
           opah."ordemPagamentoAgrupadoId",
           opah."userBankCode",
           opah."userBankAgency",
           opah."userBankAccount",
           opah."userBankAccountDigit"
    from ordem_pagamento_agrupado_historico opah
    where opa.id = opah."ordemPagamentoAgrupadoId"
      and opah."dataReferencia" = (select max("dataReferencia") from ordem_pagamento_agrupado_historico where "ordemPagamentoAgrupadoId" = opa.id)
    ) opah on opah."ordemPagamentoAgrupadoId" = opa.id
         inner join "user" u on op."userId" = u.id
    and ("userId" = any($1) or $1 is null)
    and (date_trunc('day', op."dataCaptura") BETWEEN $2 and $3 or $2 is null or $3 is null)
    and ("statusRemessa" = any($4) or $4 is null)
    and (trim(upper("nomeConsorcio")) = any($5) or $5 is null)
    and (op.valor >= $6 or $6 is null)
    and (op.valor <= $7 or $7 is null)
    order by u."fullName"`;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}
  private logger = new CustomLogger(RelatorioNovoRemessaRepository.name, { timestamp: true });

  // public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
  //   if (filter.consorcioNome) {
  //     filter.consorcioNome = filter.consorcioNome.map((c) => {  return c.toUpperCase().trim();});
  //   }

  //   const parametersQueryVanzeiros =
  //     [
  //       filter.userIds || null,
  //       filter.dataInicio || null,
  //       filter.dataFim || null,
  //       this.getStatusParaFiltro(filter),
  //       filter.valorMin || null,
  //       filter.valorMax || null,
  //     ];

  //   const parametersQueryConsorciosEModais =
  //     [
  //       filter.dataInicio || null,
  //       filter.dataFim || null,
  //       this.getStatusParaFiltro(filter),
  //       filter.consorcioNome || null,
  //       filter.valorMin || null,
  //       filter.valorMax || null,
  //     ];

  //   const queryRunner = this.dataSource.createQueryRunner();
  //   await queryRunner.connect();
  //   let result : any[] = [];
  //   let resultConsorciosEModais : any[] = [];
  //   let resultVanzeiros : any[] = [];

  //   if (filter.todosVanzeiros) {
  //     filter.userIds = undefined;
  //     resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, 
  //       parametersQueryVanzeiros);             
  //   }

  //   if (filter.todosConsorcios) {
  //     filter.consorcioNome = undefined;
  //     resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS,
  //        parametersQueryConsorciosEModais);
  //   }

  //   if (filter.userIds && filter.userIds.length > 0) {
  //     resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, 
  //       parametersQueryVanzeiros);
  //   }

  //   if (filter.consorcioNome && filter.consorcioNome.length > 0) {
  //     resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS, parametersQueryConsorciosEModais);
  //   }

  //   // Nenhum critério, trás todos.
  //   if (!filter.todosVanzeiros &&
  //     !filter.todosConsorcios
  //     && (!filter.userIds || filter.userIds.length == 0) && (!filter.consorcioNome || filter.consorcioNome.length == 0)) {
  //     resultVanzeiros = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_VANZEIROS, parametersQueryVanzeiros);
  //     resultConsorciosEModais = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_CONSOLIDADO_CONSORCIOS,
  //        parametersQueryConsorciosEModais);
  //   }

  //   result = resultVanzeiros.concat(resultConsorciosEModais);

  //   await queryRunner.release();
  //   const count = result.length;
  //   const valorTotal = result.reduce((acc, curr) => acc + Number(curr.valorTotal), 0);
  //   const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();
    
  //   relatorioConsolidadoDto.valor = parseFloat(valorTotal);

  //   relatorioConsolidadoDto.count = count;
  //   relatorioConsolidadoDto.data = result
  //     .map((r) => {
  //       const elem = new RelatorioConsolidadoNovoRemessaData();
  //       elem.nomefavorecido = r.fullName;
  //       elem.valor = parseFloat(r.valorTotal);
  //       return elem;
  //     });
  //   return relatorioConsolidadoDto;
  // }

  public async findConsolidado(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();     
    
    let sql = ` `; 

    let sqlModais;

    let sqlConsorcios;

    if(filter.todosVanzeiros || filter.userIds){
      sqlModais = this.consultaVanzeiros(filter);
    }
    
    if(filter.todosConsorcios || filter.consorcioNome){
      sqlConsorcios = this.consultaConsorcios(filter);
    }
   
    if(sqlModais && sqlConsorcios){
      sql = sqlModais + ` union all `+ sqlConsorcios; 
    }else if(sqlModais){
      sql = sqlModais;      
    }else if(sqlConsorcios){
      sql = sqlConsorcios;
    }
    
    sql = `select * from (${sql}) vv where (1=1) `;

    if(filter.valorMin){    
      sql = sql +` and vv."valor">=${filter.valorMin} `
    } 
    
    if(filter.valorMax){
      sql = sql +` and vv."valor"<=${filter.valorMax} `
    }  
    
    const result: any[] = await queryRunner.query(sql);
    
    const count = result.length;

    let valorTotal;
    
    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();

    if(filter.aPagar!=undefined || filter.emProcessamento!=undefined){
      const sqlPagar =  this.somatorioTotalAPagar(sql);
     
      const resultTotal: any[] = await queryRunner.query(sqlPagar);

      valorTotal = resultTotal.map(r => r.valor)
    }

    if(filter.pago!=undefined || filter.erro!=undefined){
      const sqlPago =  this.somatorioTotalPagoErro(sql);

      const resultTotal: any[] = await queryRunner.query(sqlPago);

      valorTotal = resultTotal.map(r => r.valor)
    }

    relatorioConsolidadoDto.valor = parseFloat(valorTotal);
    relatorioConsolidadoDto.count = count;
    relatorioConsolidadoDto.data = result
      .map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.nome;
        elem.valor = parseFloat(r.valor);
        return elem;
      });

    await queryRunner.release();

    return relatorioConsolidadoDto;
  }

  public async findSintetico(filter: IFindPublicacaoRelatorioNovoRemessa): Promise<RelatorioConsolidadoNovoRemessaDto> {
    this.logger.debug(RelatorioNovoRemessaRepository.QUERY_SINTETICO);

    if (filter.consorcioNome) {
      filter.consorcioNome = filter.consorcioNome.map((c) => { return c.toUpperCase().trim();});
    }

    const parameters =
      [
        filter.userIds || null,
        filter.dataInicio || null,
        filter.dataFim || null,
        this.getStatusParaFiltro(filter),
        filter.consorcioNome || null,
        filter.valorMin || null,
        filter.valorMax || null
      ];

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    const result: any[] = await queryRunner.query(RelatorioNovoRemessaRepository.QUERY_SINTETICO, parameters);
    await queryRunner.release();
    const count = result.length;
    const valorTotal = result.reduce((acc, curr) => acc + parseFloat(curr.valorTotal), 0);
    const relatorioConsolidadoDto = new RelatorioConsolidadoNovoRemessaDto();
    relatorioConsolidadoDto.valor = parseFloat(valorTotal);
    relatorioConsolidadoDto.count = count;
    relatorioConsolidadoDto.data = result
      .map((r) => {
        const elem = new RelatorioConsolidadoNovoRemessaData();
        elem.nomefavorecido = r.fullName;
        elem.valor = parseFloat(r.valorTotal);
        return elem;
      });
    return relatorioConsolidadoDto;
  }

  private getStatusParaFiltro(filter: IFindPublicacaoRelatorioNovoRemessa) {
    let statuses: number[] | null = null;
    if (filter.emProcessamento || filter.pago || filter.erro || filter.aPagar) {
      statuses = [];

      if (filter.aPagar) {
        statuses.push(0);
        statuses.push(1);
      }
      if (filter.emProcessamento) {
        statuses.push(2);
      }

      if (filter.pago) {
        statuses.push(3);
      }

      if (filter.erro) {
        statuses.push(4);
      }
    }
    return statuses;
  }

  private consultaVanzeiros(filter:IFindPublicacaoRelatorioNovoRemessa){
    const dataInicio = formatDateISODate(filter.dataInicio) 
    const dataFim = formatDateISODate(filter.dataFim) 
    
    let sql = ``;
      
    let condicoes = '';
 
    if(filter.aPagar!==undefined || filter.emProcessamento!==undefined){
      sql = `select distinct uu."fullName"nome,op."nomeConsorcio",opa."valor" `;
      sql = sql + RelatorioNovoRemessaRepository.QUERY_FROM;
      condicoes = condicoes +` and (date_trunc('day', op."dataCaptura") BETWEEN '${dataInicio}' and '${dataFim}' ) `;     
    }

    if(filter.pago!==undefined || filter.erro!==undefined){
      sql = `select distinct uu."fullName"nome,op."nomeConsorcio", da."valorLancamento" valor `;
      sql = sql + RelatorioNovoRemessaRepository.QUERY_FROM;
      condicoes = condicoes +` and da."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim}' `; 
    }

    let statuses =  this.getStatusParaFiltro(filter);
    if (filter.emProcessamento || filter.pago || filter.erro || filter.aPagar){
      condicoes = condicoes + ` and oph."statusRemessa" in(${statuses}) `;
    }

    if(filter.userIds){
      condicoes = condicoes +` and "userId" in('${filter.userIds.join("','")}') `;
    }else if(filter.todosVanzeiros){
      condicoes = condicoes + ` and op."nomeConsorcio" in('STPC','STPL','TEC') `;
    }    
    return sql + condicoes;
  }

  private consultaConsorcios(filter:IFindPublicacaoRelatorioNovoRemessa){
    const dataInicio = formatDateISODate(filter.dataInicio); 
    const dataFim = formatDateISODate(filter.dataFim);        
   
    let sql = ``;

    let condicoes = '';
 
    if(filter.aPagar!=undefined || filter.emProcessamento!=undefined){
      sql = `select distinct  uu."fullName",op."nomeConsorcio" nome, opa."valorTotal" valor `
      sql = sql + RelatorioNovoRemessaRepository.QUERY_FROM;
      condicoes = condicoes +` and (date_trunc('day', op."dataCaptura") BETWEEN '${dataInicio}' and '${dataFim}' ) `;      
    }

    if(filter.pago!=undefined || filter.erro!=undefined){
      sql = `select distinct uu."fullName",op."nomeConsorcio" nome, da."valorLancamento" valor `;
      sql = sql + RelatorioNovoRemessaRepository.QUERY_FROM;
      condicoes = condicoes +` and  da."dataVencimento" BETWEEN '${dataInicio}' and '${dataFim}' `; 
    }

    let statuses =  this.getStatusParaFiltro(filter);
    if (filter.emProcessamento || filter.pago || filter.erro || filter.aPagar){
      condicoes = condicoes + ` and oph."statusRemessa" in(${statuses}) `;
    }   

    if(filter.todosConsorcios){
      condicoes = condicoes +` and op."nomeConsorcio" in('STPC','STPL','VLT','Santa Cruz',
        'Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    }else if(filter.consorcioNome){
      condicoes = condicoes +` and op."nomeConsorcio" in('${filter.consorcioNome.join("','")}') `
    }    
    
    sql =  `select "nome", null as "nomeConsorcio", sum("valor") valor from (`+ sql + condicoes+`)r group by r."nome" ` ;

    return sql;
  }

  private somatorioTotalPagoErro(sql:string){
    return `select sum("valor") valor from (`+sql+`) s `; 
  }

  private somatorioTotalAPagar(sql:string){
    return `select sum("valor") valor from (`+sql+`) s `;
  }
}