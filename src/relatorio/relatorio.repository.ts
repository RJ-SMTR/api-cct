import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { endOfDay, startOfDay } from 'date-fns';
import { getDateYMDString as toDateString } from 'src/utils/date-utils';
import { parseStringUpperUnaccent } from 'src/utils/string-utils';
import { RelatorioDto } from './dtos/relatorio.dto';

@Injectable()
export class RelatorioRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * A partir dos dados primordiais (Publicacao e outros), transforma em Relatorios
   *
   * @param publicacoes ArquivoPublicacoes encontrados
   * @param detalhesA Todos os DetalhesA associados aos ArquivoPublicacoes
   * @param ocorrencias Todas as Ocorrencias associadas aos DetalhesA
   */
  public async find(args: IFindPublicacaoRelatorio) {
    const where = this.getWhere(args);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    let result = await queryRunner.query(
      `
      SELECT
          p.id
          ,p."valorRealEfetivado"
          ,p."isPago"
          ,CASE WHEN (p."dataGeracaoRetorno" IS NULL) THEN true ELSE false END AS "isPendente"
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
    `,
      // .replace(/\n\s+/g, ' ')
    );
    queryRunner.release();
    result = result.map((r) => new RelatorioDto(r));
    return result;
  }

  private getWhere(args: IFindPublicacaoRelatorio) {
    const where: string[] = [];
    const startDate = toDateString(args?.dataInicio || startOfDay(new Date(0)));
    const endDate = toDateString(args?.dataFim || endOfDay(new Date()));
    where.push(`i."dataOrdem" BETWEEN '${startDate}' AND '${endDate}'`);

    if (args?.valorRealEfetivadoInicio) {
      const startValue = args?.valorRealEfetivadoInicio || 0;
      const endValue = args?.valorRealEfetivadoFim || startValue;
      where.push(`p."valorRealEfetivado" BETWEEN ${startValue} AND ${endValue}`);
    }

    if (args?.ocorrenciaCodigo) {
      where.push(`o.code IN ('${args?.ocorrenciaCodigo.join("','")}')`);
    }

    const nomes = (args?.favorecidoNome || []).map((n) => parseStringUpperUnaccent(n));
    if (nomes.length) {
      const nomesOr = nomes.map((n) => `UNACCENT(UPPER(f.nome)) ILIKE'%${n}%'`).join(' OR ');
      where.push(`(${nomesOr})`);
    }

    const cpfCnpjs = args?.favorecidoCpfCnpj || [];
    if (cpfCnpjs.length) {
      where.push(`f."cpfCnpj" IN ('${cpfCnpjs.join("','")}')`);
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

    return where;
  }
}
