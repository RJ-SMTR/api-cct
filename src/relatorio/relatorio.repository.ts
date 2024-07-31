import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { endOfDay, startOfDay } from 'date-fns';
import { getDateYMDString as toDateString } from 'src/utils/date-utils';
import { parseStringUpperUnaccent } from 'src/utils/string-utils';
import { RelatorioDto } from './dtos/relatorio.dto';
import { RelatorioConsolidadoDto } from './dtos/relatorio-consolidado.dto';

@Injectable()
export class RelatorioRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  public async findConsolidado(args: IFindPublicacaoRelatorio) {
    let union: string[] = [];
    if (args?.consorcioNome?.length) {
      union.push(this.getConsolidadoQuery(args, 'consorcio'));
    }
    if (!args?.consorcioNome?.length || args?.favorecidoNome?.length || args?.favorecidoCpfCnpj?.length) {
      union.push(this.getConsolidadoQuery(args, 'favorecido'));
    }
    if (union.length > 1) {
      union = union.map((select) => `(${select})`);
    }
    const query = union.join(`\n    UNION ALL\n    `);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result: any[] = await queryRunner.query(query);
    queryRunner.release();
    const consolidados = result.map((r) => new RelatorioConsolidadoDto(r));
    return consolidados;
  }

  getConsolidadoQuery(args: IFindPublicacaoRelatorio, groupBy: 'consorcio' | 'favorecido') {
    const _args = structuredClone(args);
    if (groupBy === 'consorcio') {
      _args.favorecidoCpfCnpj = undefined;
      _args.favorecidoNome = undefined;
    } else {
      _args.consorcioNome = undefined;
    }
    const { where, having } = this.getWhere(_args);
    const d = args.decimais || 2;
    const groupCol = groupBy == 'consorcio' ? 'i."nomeConsorcio"' : 'f.nome';
    const query = `
      SELECT
          ${groupCol} AS nome
          ,count(p.id)::int AS "count"
          ,round(sum(i.valor), ${d})::float AS valor
          ,round(sum(p."valorRealEfetivado"), ${d})::float AS "valorRealEfetivado"
          ,sum(CASE WHEN p."isPago" THEN 1 ELSE 0 END)::int AS "pagoCount"
          ,sum(CASE WHEN (o."code" NOT IN ('00', 'BD')) THEN 1 ELSE 0 END)::int AS "erroCount"
          ,json_agg(json_build_object(
              'ocorrencia', CASE WHEN o.id IS NOT NULL THEN json_build_object(
                  'id', o.id,
                  'code', o.code
              ) ELSE NULL END,
              'valor', round(i.valor, ${d})::float
          )) AS ocorrencias
      FROM
          arquivo_publicacao p
          INNER JOIN item_transacao i ON i.id = p."itemTransacaoId"
          INNER JOIN cliente_favorecido f ON f.id = i."clienteFavorecidoId"
          INNER JOIN detalhe_a a ON a."itemTransacaoAgrupadoId" = i."itemTransacaoAgrupadoId"
          LEFT JOIN ocorrencia o ON o."detalheAId" = a.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ``}
      GROUP BY ${groupCol}
      ${having.length ? `HAVING ${having.join(' AND ')}` : ``}
      ORDER BY ${groupCol}
    `;
    // .replace(/\n\s+/g, ' ')
    return query;
  }

  /**
   * A partir dos dados primordiais (Publicacao e outros), transforma em Relatorios
   *
   * @param publicacoes ArquivoPublicacoes encontrados
   * @param detalhesA Todos os DetalhesA associados aos ArquivoPublicacoes
   * @param ocorrencias Todas as Ocorrencias associadas aos DetalhesA
   */
  public async findDetalhado(args: IFindPublicacaoRelatorio) {
    const { where, having } = this.getWhere(args);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result = await queryRunner.query(
      `
      SELECT
          p.id
          ,p."valorRealEfetivado"
          ,sum(CASE WHEN p."isPago" THEN 1 ELSE 0 END) AS "pagoCount"
          ,sum(CASE WHEN (o."code" NOT IN ('00', 'BD')) THEN 1 ELSE 0 END) AS "erroCount"
          ,p."dataGeracaoRetorno"
          ,i.id AS "itemTransacaoId"
          ,i.valor
          ,i."dataOrdem"
          ,i."createdAt" AS "dataCriacaoOrdem"
          ,CASE WHEN COUNT(o.id) > 0 THEN json_agg(json_build_object(
              'ocorrencia', json_build_object(
                  'id', o.id,
                  'code', o.code,
                  'message', o.message,
                  'detalheA', json_build_object(
                      'id', o."detalheAId",
                      'itemTransacaoAgrupado', i."itemTransacaoAgrupadoId"
                  )
              ),
              'valor', i.valor,
              'count', 1,
              '_arquivoPublicacaoId', p.id 
          )) ELSE '[]' END AS ocorrencias
          ,i."itemTransacaoAgrupadoId"
          ,i."nomeConsorcio"
          ,f.id AS "clienteFavorecidoId"
          ,f.nome AS "nomeFavorecido"
          ,f."cpfCnpj"
      FROM
          arquivo_publicacao p
          INNER JOIN item_transacao i ON i.id = p."itemTransacaoId"
          INNER JOIN cliente_favorecido f ON f.id = i."clienteFavorecidoId"
          INNER JOIN detalhe_a a ON a."itemTransacaoAgrupadoId" = i."itemTransacaoAgrupadoId"
          LEFT JOIN ocorrencia o ON o."detalheAId" = a.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ``}
      GROUP BY p.id, f.id, a.id, i.valor, i."dataOrdem", i."createdAt", i.id
      ${having.length ? `WHERE ${having.join(' AND ')}` : ``}
    `,
      // .replace(/\n\s+/g, ' ')
    );
    queryRunner.release();
    result = result.map((r) => new RelatorioDto(r));
    return result;
  }

  private getWhere(args: IFindPublicacaoRelatorio) {
    const where: string[] = [];
    const having: string[] = [];
    const d = args.decimais || 2;

    const dataOrdem = {
      inicio: toDateString(args?.dataInicio || startOfDay(new Date(0))),
      fim: toDateString(args?.dataFim || endOfDay(new Date())),
    };
    where.push(`i."dataOrdem" BETWEEN '${dataOrdem.inicio}' AND '${dataOrdem.fim}'`);

    const valorReal = { min: args?.valorRealEfetivadoMin, max: args?.valorRealEfetivadoMax };
    if (valorReal?.min !== undefined && valorReal.max === undefined) {
      having.push(`round(sum(p."valorRealEfetivado"), ${d}) >= ${valorReal.min}`);
    } else if (valorReal?.min === undefined && valorReal.max !== undefined) {
      having.push(`round(sum(p."valorRealEfetivado"), ${d}) <= ${valorReal.max}`);
    } else if (valorReal?.min !== undefined && valorReal.max !== undefined) {
      having.push(`round(sum(p."valorRealEfetivado"), ${d}) BETWEEN ${valorReal.min} AND ${valorReal.max}`);
    }

    const valor = { min: args?.valorMin, max: args?.valorMax };
    if (valor?.min !== undefined && valor.max === undefined) {
      having.push(`round(sum(i."valor"), ${d}) >= ${valor.min}`);
    } else if (valor?.min === undefined && valor.max !== undefined) {
      having.push(`round(sum(i."valor"), ${d}) <= ${valor.max}`);
    } else if (valor?.min !== undefined && valor.max !== undefined) {
      having.push(`round(sum(i."valor"), ${d}) BETWEEN ${valor.min} AND ${valor.max}`);
    }

    if (args?.ocorrenciaCodigo) {
      where.push(`o.code IN ('${args?.ocorrenciaCodigo.join("','")}')`);
    }

    const favorecidoNomes = (args?.favorecidoNome || []).map((n) => parseStringUpperUnaccent(n));
    if (favorecidoNomes.length) {
      const nomesOr = favorecidoNomes.map((n) => `UNACCENT(UPPER(f.nome)) ILIKE'%${n}%'`).join(' OR ');
      where.push(`(${nomesOr})`);
    }

    const cpfCnpjs = args?.favorecidoCpfCnpj || [];
    if (cpfCnpjs.length) {
      where.push(`f."cpfCnpj" IN ('${cpfCnpjs.join("','")}')`);
    }

    const consorcioNomes = (args?.consorcioNome || []).map((n) => parseStringUpperUnaccent(n));
    if (consorcioNomes.length) {
      const nomesOr = consorcioNomes.map((n) => `UNACCENT(UPPER(i."nomeConsorcio")) ILIKE'%${n}%'`).join(' OR ');
      where.push(`(${nomesOr})`);
    }

    if (args?.pago !== undefined) {
      where.push(`p."isPago" =  ${args.pago}`);
    }

    if (args?.erro !== undefined) {
      if (args.erro) {
        where.push(`(o.code IS NOT NULL AND o.code NOT IN ('BD','00'))`);
      } else {
        where.push(`(o.code IS NULL OR o.code IN ('BD','00'))`);
      }
    }

    return { where, having };
  }
}
