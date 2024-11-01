import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { DataSource } from 'typeorm';
import { RelatorioAnaliticoDto } from './dtos/relatorio-analitico.dto';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { compactQuery } from 'src/utils/console-utils';

@Injectable()
export class RelatorioAnaliticoRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private logger = new CustomLogger(RelatorioAnaliticoRepository.name, { timestamp: true });

  private getQuery(args: IFindPublicacaoRelatorio) {
    if (args.aPagar === true) {
      return this.getQueryApagar(args);
    } else if (args.aPagar === false || args.aPagar === undefined) {
      return this.getQueryNaoApagar(args);
    } else {
      return this.getQueryApagar(args) + ` union all ` + this.getQueryNaoApagar(args);
    }
  }

  public async findAnalitico(args: IFindPublicacaoRelatorio): Promise<RelatorioAnaliticoDto[]> {
    const query = this.getQuery(args);
    this.logger.debug(compactQuery(query));
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(compactQuery(query));
    queryRunner.release();
    const analiticos = result.map((r) => new RelatorioAnaliticoDto(r));
    const test = analiticos.filter((a) => (a.favorecido == 'GLAUCIUS CESAR MANEZES BARAO'));
    this.setSomas(analiticos);
    return analiticos;
  }

  setSomas(analiticos: RelatorioAnaliticoDto[]) {
    const [subtotais, total] = this.getSomas(analiticos);
    for (const i in analiticos) {
      const item = analiticos[+i];
      item.setSubtotal(subtotais);
      item.setTotal(total);
    }
  }

  getSomas(analiticos: RelatorioAnaliticoDto[]): [Record<string, number>, number] {
    let total: number = 0;
    const subtotais = analiticos.reduce((d: Record<string, number>, i) => {
      total += i.valor;
      const key = i.consorcio;
      if (d[key]) {
        return { ...d, [key]: d[key] + i.valor };
      } else {
        return { ...d, [key]: i.valor };
      }
    }, {});
    return [subtotais, total];
  }

  public getQueryApagar(args: IFindPublicacaoRelatorio) {
    const dataInicio = args.dataInicio.toISOString().slice(0, 10);
    const dataFim = args.dataFim.toISOString().slice(0, 10);
    let query = `WITH subtotal_data AS ( `;
    query = query + `    SELECT  `;
    query = query + `    tv."nomeConsorcio", `;
    query = query + `    SUM(tv."valorPago") AS subTotal `;
    query = query + `    FROM transacao_view tv `;
    query = query + `    WHERE tv."valorPago" > 0 `;
    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) {
      query = query + `  AND tv."datetimeTransacao" BETWEEN '${dataInicio + ' 00:00:00'}' and '${dataFim + ' 23:59:59'}' `;
    }
    query = query + `    AND tv."itemTransacaoAgrupadoId" IS NULL `;
    query = query + `    GROUP BY tv."nomeConsorcio" ), `;
    query = query + `total_data AS ( `;
    query = query + `     SELECT  `;
    query = query + `     SUM(tv."valorPago") AS Total `;
    query = query + `     FROM transacao_view tv `;
    query = query + `     WHERE tv."valorPago" > 0 `;
    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) {
      query = query + ` AND tv."datetimeTransacao" BETWEEN '${dataInicio + ' 00:00:00'}' and '${dataFim + ' 23:59:59'}' `;
    }

    if (args.consorcioNome !== undefined && !['Todos'].some((i) => args.consorcioNome?.includes(i))) {
      query = query + ` AND tv."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;
    } else if ((['Todos'].some((i) => args.consorcioNome?.includes(i)) && ['Todos'].some((i) => args.favorecidoNome?.includes(i))) || (args.consorcioNome !== undefined && args.favorecidoNome !== undefined)) {
      query =
        query +
        ` AND tv."nomeConsorcio" in ('STPC','STPL','VLT','Santa Cruz',
           'Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      query = query + ` AND tv."nomeConsorcio" in('STPC','STPL') `;
    }
    query = query + ` AND tv."itemTransacaoAgrupadoId" IS NULL) `;

    query = query + `  SELECT DISTINCT `;
    query = query + `  res.*, `;
    query = query + `  COALESCE(sub.subTotal, 0) AS subTotal,`;
    query = query + `  total_data.Total`;
    query = query + `  FROM (`;

    let body = ` SELECT DISTINCT
        tv.id,
        (tv."datetimeTransacao":: DATE)::VARCHAR AS datatransacao,
        CASE
        WHEN tv."nomeConsorcio" = 'VLT' THEN (tv."datetimeTransacao":: DATE + INTERVAL '2 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 0 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '3 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 1 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '2 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 2 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '8 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 3 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '7 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 4 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '6 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 5 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '5 day')::VARCHAR
        WHEN tv."nomeConsorcio" <> 'VLT' AND EXTRACT(DOW FROM tv."datetimeTransacao") = 6 THEN 
        (tv."datetimeTransacao":: DATE + INTERVAL '4 day')::VARCHAR
        END AS datapagamento,
        tv."nomeConsorcio" AS consorcio,
        COALESCE(cf.nome,uu."fullName") AS favorecido,
        tv."operadoraCpfCnpj" cpfCnpj,
        ROUND(tv."valorPago", 2)::FLOAT AS valor,
        'a pagar' AS status,
        '' AS mensagem_status `;

    body = body + `FROM transacao_view tv `;
    body = body + `LEFT JOIN cliente_favorecido cf ON tv."operadoraCpfCnpj" = cf."cpfCnpj" `;
    body = body + `LEFT JOIN public.user uu on uu."cpfCnpj"=tv."operadoraCpfCnpj" `;
    let conditions = `where tv."valorPago" >0 and`;

    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) conditions = conditions + ` tv."datetimeTransacao" between '${dataInicio + ' 00:00:00'}' and '${dataFim + ' 23:59:59'}' `;

    if (args.consorcioNome !== undefined && !['Todos'].some((i) => args.consorcioNome?.includes(i))) {
      conditions = conditions + ` and tv."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`;
    } else if (args.favorecidoNome !== undefined && !['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      conditions = conditions + ` and cf."nome" in('${args.favorecidoNome?.join("','")}')`;
    } else if ((['Todos'].some((i) => args.consorcioNome?.includes(i)) && ['Todos'].some((i) => args.favorecidoNome?.includes(i))) || (args.consorcioNome !== undefined && args.favorecidoNome !== undefined)) {
      conditions =
        conditions +
        ` and tv."nomeConsorcio" 
          in ('STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio','TEC') `;
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i)) && args.consorcioNome !== undefined) {
      conditions = conditions + ` and tv."nomeConsorcio" in('STPC','STPL',${args.consorcioNome?.join("','")}) `;
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      conditions = conditions + ` and tv."nomeConsorcio" in('STPC','STPL') `;
    }

    let footer = `) AS res
        LEFT JOIN subtotal_data sub 
          ON res."consorcio" = sub."nomeConsorcio"          
        CROSS JOIN total_data
        ORDER BY res."consorcio", res."favorecido", res."datapagamento"`;

    let result = ` select * from ( ` + query + body + conditions + footer + ` ) as tt  where (1=1)`;
    return result;
  }

  public getQueryNaoApagar(args: IFindPublicacaoRelatorio) {
    const dataInicio = args.dataInicio.toISOString().slice(0, 10);
    const dataFim = args.dataFim.toISOString().slice(0, 10);

    const where1: string[] = [];
    const where2: string[] = [];

    if (args.consorcioNome !== undefined && !['Todos'].some((i) => args.consorcioNome?.includes(i))) {
      where1.push(`it."nomeConsorcio" in('${args.consorcioNome?.join("','")}')`);
    } else if (args.favorecidoNome !== undefined && !['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      where1.push(`cf."nome" in('${args.favorecidoNome?.join("','")}')`);
    } else if ((['Todos'].some((i) => args.consorcioNome?.includes(i)) && ['Todos'].some((i) => args.favorecidoNome?.includes(i))) || (args.consorcioNome !== undefined && args.favorecidoNome !== undefined)) {
      where1.push(`it."nomeConsorcio" in ('STPC','STPL','VLT','Santa Cruz','Internorte','Intersul','Transcarioca','MobiRio','TEC')`);
    } else if (['Todos'].some((i) => args.favorecidoNome?.includes(i))) {
      where1.push(` and it."nomeConsorcio" in('STPC','STPL','TEC')`);
    }
    if (args.emProcessamento !== undefined && args.emProcessamento === true) {
      where1.push(`ap."isPago" = false AND TRIM(da."ocorrenciasCnab") = ''`);
    } else if (args.pago !== undefined) {
      where1.push(`ap."isPago" = ${args.pago} AND TRIM(da."ocorrenciasCnab") <> ''`);
    }
    if (args.valorMin !== undefined) {
      where1.push(`it."valor" >= ${args.valorMin}`);
    }
    if (args.valorMax !== undefined) {
      where1.push(`it."valor" <= ${args.valorMax}`);
    }

    if (dataInicio !== undefined && dataFim !== undefined && (dataFim === dataInicio || new Date(dataFim) > new Date(dataInicio))) {
      where2.push(`it."dataVencimento"::DATE BETWEEN '${dataInicio}' AND '${dataFim}'`);
    }

    const query = `
        SELECT
            DISTINCT res.*,
            0 AS subtotal,
            0 AS total
        FROM
        (   -- agrupa status de vanzeiro (caso seja) igual à tela do semanal  --
            SELECT
                MIN(tv."dataEfetivacao") AS "dataEfetivacao",
                MIN(tv."dataVencimento") AS "dataVencimento",
                MIN(tv.sexta_pgto) AS sexta_pgto,
                MIN(tv.favorecido) AS favorecido,
                MIN(tv.consorcio) AS consorcio,
                MIN(tv.valor) AS valor,
                MIN(tv.valor_ordem) AS valor_ordem,
                MIN(tv.data_ordem)::DATE AS data_ordem,
                MIN(tv.dataprocessamento) AS dataprocessamento,
                MIN(tv.datatransacao) AS datatransacao,
                MIN(tv.datapagamento) AS datapagamento,
                MIN(tv.tv_id) AS tv_id,
                MIN(tv.it_id) AS it_id,
                CASE WHEN BOOL_AND(tv.is_vanzeiro) = false THEN MIN(tv.status_nao_vanzeiro) ELSE (
                    CASE
                        WHEN (NOT(BOOL_AND(tv.van_is_pago)) AND TRIM(MIN(tv.van_ocorrencias)) = '' ) THEN 'Aguardando Pagamento'
                        WHEN (BOOL_AND(tv.van_is_pago)) THEN 'pago'
                        WHEN (NOT(BOOL_AND(tv.van_is_pago))) THEN 'naopago'
                        ELSE 'apagar'
                    end
                ) END AS status
            FROM
            (   -- join ordem vanzeiro - para ter status igual na tela do semanal (caso seja de vanzeriro)  --
                SELECT
                    tv.*,
                    ap."isPago" AS van_is_pago,
                    da."ocorrenciasCnab" AS van_ocorrencias,
                    it.id AS van_it_id
                FROM
                (  -- 4. filtrar ordem da transação --
                    SELECT DISTINCT ON (tv.it_id, tv.tv_id) *
                    FROM
                    (  -- 3. obter transação do agrupado --
                        SELECT
                            it.*,
                            tv.id AS tv_id,
                            (it2."dataOrdem"::DATE - tv."datetimeProcessamento"::DATE) AS date_priority,
                            it2."dataOrdem" AS data_ordem,
                            it2."dataOrdem"::DATE AS data_ordem_from_transacao,
                            it2.id AS it2_id,
                            tv."datetimeProcessamento" AS dataprocessamento,
                            tv."valorPago"::FLOAT AS valor,
                            DATE(CASE WHEN EXTRACT(DOW FROM DATE(tv."datetimeProcessamento")) = 4 THEN DATE(tv."datetimeProcessamento") + INTERVAL '8 days' ELSE tv."datetimeProcessamento"::DATE + (12 - EXTRACT(DOW FROM tv."datetimeProcessamento"::DATE)::integer + 7) % 7 + (CASE WHEN EXTRACT(DOW FROM tv."datetimeProcessamento"::DATE) = 5 THEN 7 ELSE 0 END) END) AS sexta_pgto,
                            COALESCE( it.datatransacao_vlt, tv."datetimeTransacao"::VARCHAR ) AS datatransacao
                        FROM
                        (  -- query base do sitético  -  2. obter ordens do agrupado --
                            SELECT
                                CASE
                                    WHEN (it."nomeConsorcio" = 'VLT') AND EXTRACT(DOW FROM da."dataVencimento") = 1 THEN (da."dataVencimento"::DATE - INTERVAL '4 day')::VARCHAR
                                    WHEN (it."nomeConsorcio" = 'VLT') AND EXTRACT(DOW FROM da."dataVencimento") = 2 THEN (da."dataVencimento"::DATE - INTERVAL '4 day')::VARCHAR
                                    WHEN (it."nomeConsorcio" = 'VLT') AND EXTRACT(DOW FROM da."dataVencimento") = 3 THEN (da."dataVencimento"::DATE - INTERVAL '2 day')::VARCHAR
                                    WHEN (it."nomeConsorcio" = 'VLT') AND EXTRACT(DOW FROM da."dataVencimento") = 4 THEN (da."dataVencimento"::DATE - INTERVAL '2 day')::VARCHAR
                                    WHEN (it."nomeConsorcio" = 'VLT') AND EXTRACT(DOW FROM da."dataVencimento") = 5 THEN (da."dataVencimento"::DATE - INTERVAL '2 day')::VARCHAR
                                END AS datatransacao_vlt,
                                da."dataVencimento"::DATE::VARCHAR AS datapagamento,
                                cf."cpfCnpj" AS "cpfCnpj",
                                da."dataEfetivacao" AS "dataEfetivacao",
                                da."dataVencimento" AS "dataVencimento",
                                it."nomeConsorcio" AS consorcio,
                                cf.nome AS favorecido,
                                it."valor"::float AS valor_ordem,
                                it."itemTransacaoAgrupadoId",
                                it."dataOrdem" AS data_ordem_from_agrupado,
                                it."nomeConsorcio" IN ('STPC','STPL','TEC') AS is_vanzeiro,
                                it."idOperadora",
                                it.id AS it_id,
                                CASE
                                    WHEN (NOT(ap."isPago") AND TRIM(da."ocorrenciasCnab") = '' ) THEN 'Aguardando Pagamento'
                                    WHEN (ap."isPago") THEN 'pago'
                                    WHEN (NOT (ap."isPago")) THEN 'naopago'
                                    ELSE 'apagar'
                                END AS status_nao_vanzeiro,
                                CASE WHEN (NOT (ap."isPago")) THEN oc."message" ELSE '' END AS mensagem_status
                            FROM item_transacao_agrupado ita
                                INNER JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
                                INNER JOIN item_transacao it ON ita.id = it."itemTransacaoAgrupadoId"
                                INNER JOIN transacao_agrupado ta ON ta."id" = ita."transacaoAgrupadoId"
                                AND ta."statusId" <> '5'
                                INNER JOIN arquivo_publicacao ap ON ap."itemTransacaoId" = it.id
                                INNER JOIN cliente_favorecido cf ON cf.id = it."clienteFavorecidoId"
                                LEFT JOIN ocorrencia oc ON oc."detalheAId" = da.id
                            WHERE (1 = 1) ${where1.length ? 'AND ' + where1.join(' AND ') : ''}
                        ) it
                        INNER JOIN transacao_view tv ON tv."itemTransacaoAgrupadoId" = it."itemTransacaoAgrupadoId"
                                AND tv."valorPago" :: NUMERIC > 0  -- ignora no relatório -- 
                        INNER JOIN item_transacao it2 ON it2."itemTransacaoAgrupadoId" = tv."itemTransacaoAgrupadoId"
                            AND tv."datetimeProcessamento"::DATE < it2."dataOrdem"::DATE  -- otimizar --
                        WHERE (1 = 1) ${where2.length ? 'AND ' + where2.join(' AND ') : ''}
                    ) tv
                    ORDER BY tv.it_id, tv.tv_id, tv.date_priority, tv.it_id DESC
                ) tv
                LEFT JOIN item_transacao it ON tv.is_vanzeiro = true AND it."idOperadora" = tv."idOperadora" AND it."dataOrdem"::DATE BETWEEN tv.sexta_pgto - INTERVAL '7 DAYS' AND tv.sexta_pgto - INTERVAL '1 DAY'
                LEFT JOIN item_transacao_agrupado ita ON ita.id = it."itemTransacaoAgrupadoId"
                LEFT JOIN transacao_agrupado ta ON ta.id = ita."transacaoAgrupadoId"
                LEFT JOIN arquivo_publicacao ap ON ap."itemTransacaoId" = it.id
                LEFT JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = it."itemTransacaoAgrupadoId"
                WHERE ta."statusId" != 5 AND tv.data_ordem_from_transacao = tv.data_ordem_from_agrupado
            ) tv
            GROUP BY tv.tv_id
        ) AS res
        ORDER BY "consorcio", "favorecido", "datapagamento", "dataprocessamento"
    `;
    this.logger.debug(compactQuery(query));
    return query;
  }
}
