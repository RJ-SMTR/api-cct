import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { addDays, eachDayOfInterval, endOfDay, isFriday, isThursday, isWednesday, nextFriday, startOfDay } from 'date-fns';
import { getDateYMDString, getDateYMDString as toDateString } from 'src/utils/date-utils';
import { parseStringUpperUnaccent } from 'src/utils/string-utils';
import { DataSource } from 'typeorm';
import { RelatorioConsolidadoDto } from './dtos/relatorio-consolidado.dto';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';

@Injectable()
export class RelatorioRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private CONSOLIDADO_WITH = `
    WITH
    cte_detalhe_a AS (
        SELECT 
            da.*,
            CASE
                WHEN da."ocorrenciasCnab" IS NULL OR da."ocorrenciasCnab" = '' THEN ARRAY[]::TEXT[]
                ELSE array_agg(SUBSTRING(da."ocorrenciasCnab" FROM i FOR 2))
            END AS ocorrencias_cnab_list
        FROM detalhe_a da
        LEFT JOIN generate_series(1, length(COALESCE(da."ocorrenciasCnab", '')), 2) AS s(i) ON (da."ocorrenciasCnab" IS NOT NULL AND da."ocorrenciasCnab" <> '')
        GROUP BY da.id
    ),
    cte_desagrupado AS (
        SELECT
            ita.id AS id,
            ROW_NUMBER() OVER (PARTITION BY ita.id ORDER BY it.id) AS row_num,
            ita."nomeConsorcio" AS consorcio,
            ita."idOperadora" AS id_operadora,
            ita."idConsorcio" AS id_consorcio,
            cf.nome AS favorecido,
            cf."cpfCnpj" AS favorecido_cpfcnpj,
            DATE(ita."dataCaptura") AS data_agrupado,
            it."dataCaptura" AS data_item,
            DATE(da."dataVencimento") AS data_vencimento,
            it.valor AS valor_item,
            it.valor AS valor_efetivado_item,
            da."valorLancamento" AS valor_agrupado,
            da."valorRealEfetivado" AS valor_efetivado_agrupado,
            ('00' = ANY(da.ocorrencias_cnab_list) OR 'BD' = ANY(da.ocorrencias_cnab_list)) AS is_pago,
            da."dataEfetivacao" IS NOT NULL AND '00' != ANY(da.ocorrencias_cnab_list) AND 'BD' != ANY(da.ocorrencias_cnab_list) AS is_erro,
            da."dataEfetivacao" IS NULL AS is_a_pagar,
            da.ocorrencias_cnab_list AS ocorrencias_cnab_list,
            da."ocorrenciasCnab" AS ocorrencias_cnab
        FROM
            cte_detalhe_a da
            INNER JOIN item_transacao_agrupado ita ON ita.id = da."itemTransacaoAgrupadoId"
            INNER JOIN item_transacao it ON it."itemTransacaoAgrupadoId" = ita.id
            INNER JOIN cliente_favorecido cf ON cf.id = it."clienteFavorecidoId"
        -- GROUP BY ita.id
        ORDER BY
            ita.id desc, cf.nome, ita."nomeConsorcio"
    )
  `;

  public async findConsolidado(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoDto[]> {
    let union: string[] = [];
    if (args?.exibirConsorcios || args?.consorcioNome?.length) {
      union.push(this.getConsolidadoQuery(args, 'consorcio'));
    }
    if (args?.exibirFavorecidos || args?.favorecidoNome?.length || args?.favorecidoCpfCnpj?.length) {
      union.push(this.getConsolidadoQuery(args, 'favorecido'));
    }
    if (union.length > 1) {
      union = union.map((select) => `(${select})`);
    }
    const qWith = union.length ? this.CONSOLIDADO_WITH : '';
    const query = qWith + union.join(`\n    UNION ALL\n    `);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const consolidados = result.map((r) => new RelatorioConsolidadoDto(r));
    return consolidados;
  }

  getConsolidadoQuery(args: IFindPublicacaoRelatorio, groupBy: 'consorcio' | 'favorecido') {
    const { where, having, whereArgs } = this.getConsolidadoWhere(args, groupBy);
    const groupCol = `d.${groupBy}`;
    const query = `
    SELECT
        ${groupCol} AS nome,
        SUM(CASE WHEN d.row_num = 1 THEN ${whereArgs.valorCol} ELSE 0 END)::FLOAT AS valor,
        SUM(CASE WHEN d.row_num = 1 THEN 1 ELSE 0 END) AS "agrupadoCount",
        COUNT(d.id) AS "itemCount"
    FROM cte_desagrupado d
    ${where.length ? `WHERE (${where.join(') AND (')})` : ``}
    GROUP BY ${groupCol}
    ${having.length ? `HAVING (${having.join(') AND (')})` : ``}
    ORDER BY UPPER(${groupCol})
    `;
    // .replace(/\n\s+/g, ' ')
    return query;
  }

  /**
   * Regras de negócio:
   *
   * - Ao selecionar uma semana completa, incluir os itens de pagamentos pendentes; e o VLT deve ser de seg-sex.
   * - Ao selecionar um intervalo irregular, selecionar apenas os itens daquele intervalo; e o VLT seleciona o intervalo selecionado.
   * - O VLT busca pela data_vencimento
   * - Os demais, ao buscar por intervalo irregular, filtrar pela data_item; caso contrário, data_agrupado
   */
  private getConsolidadoWhere(args: IFindPublicacaoRelatorio, groupBy: 'consorcio' | 'favorecido') {
    const where: string[] = [];
    const having: string[] = [];
    const caseVlt = (_then: any, _else: any) => `(CASE WHEN d.consorcio = 'VLT' THEN ${_then} ELSE ${_else} END)`;

    const dataCaptura = {
      inicio: toDateString(args?.dataInicio || new Date(0)),
      fim: toDateString(args?.dataFim || new Date()),
    };
    const dataOrdem = {
      inicio: toDateString(nextFriday(new Date(dataCaptura.inicio))),
      fim: toDateString(nextFriday(new Date(dataCaptura.fim))),
    };

    const isSexQui = isFriday(new Date(dataCaptura.inicio)) && isThursday(new Date(dataCaptura.fim));
    const dayDateCol = isSexQui ? 'd.data_agrupado' : 'd.data_item';
    const valorCol = isSexQui ? 'd.valor_agrupado' : caseVlt('d.valor_agrupado', 'd.valor_item');
    const valorPgtoCol = isSexQui ? 'd.valor_efetivado_agrupado' : 'd.valor_efetivado_item';
    const filtrarPendentes = args.filtrarPendentes;

    const dataVLT = isSexQui
      ? {
          inicio: toDateString(addDays(new Date(dataCaptura.inicio), 3)),
          fim: toDateString(addDays(new Date(dataCaptura.fim), 1)),
        }
      : dataCaptura;

    where.push(
      caseVlt(
        `d.data_vencimento BETWEEN '${dataVLT.inicio}' AND '${dataVLT.fim}'`, // VLT
        `d.data_vencimento BETWEEN '${dataOrdem.inicio}' AND '${dataOrdem.fim}'${filtrarPendentes ? ` AND ${dayDateCol} BETWEEN '${dataCaptura.inicio}' AND '${dataCaptura.fim}'` : ''}`, // Outros
      ),
    );

    const valorEfetivado = { min: args?.valorRealEfetivadoMin, max: args?.valorRealEfetivadoMax };
    if (valorEfetivado?.min !== undefined && valorEfetivado.max === undefined) {
      having.push(`SUM(${valorPgtoCol}) >= ${valorEfetivado.min}`);
    } else if (valorEfetivado?.min === undefined && valorEfetivado.max !== undefined) {
      having.push(`SUM(${valorPgtoCol}) <= ${valorEfetivado.max}`);
    } else if (valorEfetivado?.min !== undefined && valorEfetivado.max !== undefined) {
      having.push(`SUM(${valorPgtoCol}) BETWEEN ${valorEfetivado.min} AND ${valorEfetivado.max}`);
    }

    const valor = { min: args?.valorMin, max: args?.valorMax };
    if (valor?.min !== undefined && valor.max === undefined) {
      having.push(`SUM(${valorCol}) >= ${valor.min}`);
    } else if (valor?.min === undefined && valor.max !== undefined) {
      having.push(`SUM(${valorCol}) <= ${valor.max}`);
    } else if (valor?.min !== undefined && valor.max !== undefined) {
      having.push(`SUM(${valorCol}) BETWEEN ${valor.min} AND ${valor.max}`);
    }

    if (args?.ocorrenciaCodigo) {
      where.push(`d.ocorrencias_cnab && ARRAY['${args?.ocorrenciaCodigo.join("','")}']`);
    }

    const favorecidoNomes = (args?.favorecidoNome || []).map((n) => parseStringUpperUnaccent(n));
    if (favorecidoNomes.length) {
      const includeOrNot = groupBy == 'consorcio' ? 'NOT ILIKE' : 'ILIKE';
      where.push(`UNACCENT(UPPER(d.favorecido)) ${includeOrNot} ANY(ARRAY['%${favorecidoNomes.join("%','%")}%'])`);
    }

    const cpfCnpjs = args?.favorecidoCpfCnpj || [];
    if (cpfCnpjs.length) {
      const includeOrNot = groupBy == 'consorcio' ? 'NOT IN' : 'IN';
      where.push(`d.favorecido_cpfcnpj ${includeOrNot} ('${cpfCnpjs.join("','")}')`);
    }

    const consorcioNomes = (args?.consorcioNome || []).map((n) => parseStringUpperUnaccent(n));
    if (consorcioNomes.length && groupBy == 'consorcio') {
      let nomes = [...consorcioNomes];
      if (favorecidoNomes.length || cpfCnpjs.length) {
        nomes.push('STPC', 'STPL');
      }
      nomes = [...new Set(nomes)];
      where.push(`UNACCENT(UPPER(d.consorcio)) ILIKE ANY(ARRAY['%${nomes.join("%','%")}%'])`);
    }

    if (args?.pago !== undefined || args?.erro !== undefined || args?.aPagar !== undefined) {
      const qIsErro = `d.is_erro`;
      const qNotErro = `NOT d.is_erro`;
      const qIsPago = `d.is_pago`;
      const qNotPago = `NOT d.is_pago`;
      const orWhere: string[] = [];

      if (args?.pago !== undefined) {
        orWhere.push(args.pago ? qIsPago : qNotPago);
      }
      if (args?.erro !== undefined) {
        if (args.erro) {
          orWhere.push(qIsErro);
        } else {
          orWhere.push(qNotErro);
        }
      }
      if (args?.aPagar !== undefined) {
        if (args.aPagar) {
          orWhere.push(`${qNotPago} AND ${qNotErro}`);
        } else {
          orWhere.push(`${qIsPago} OR ${qIsErro}`);
        }
      }
      if (orWhere.length) {
        where.push(`(${orWhere.join(') OR (')})`);
      }
    }

    if (groupBy == 'favorecido') {
      where.push(`d.consorcio IN ('STPC','STPL')`);
    }

    return { where, having, whereArgs: { valorCol } };
  }
}
