import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { formatDateISODate } from 'src/utils/date-utils';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { DetalheAValorLancamentoAuditoria } from 'src/cnab/entity/pagamento/detalhe-a-valor-lancamento-auditoria.entity';

export interface IPagamentoConsorcioPreparado {
  detalheAId: number;
  nomeConsorcio: string;
  nomeUsuario: string | null;
  valorAgrupado: number;
  valorBi: number;
}

export interface IAgruparPorConsorcioResult {
  agrupados: number;
  semDadosBancarios: number;
  bloqueados: number;
}

export interface IListarPreparadosParams {
  dataInicio?: Date;
  dataFim?: Date;
  busca?: string;
  page?: number;
  pageSize?: number;
  gratuidade?: boolean;
}

export interface ITotalPorConsorcio {
  nomeConsorcio: string;
  valorAgrupado: number;
  valorBi: number;
}

export interface IPagamentoConsorcioPreparadoPaginado {
  data: IPagamentoConsorcioPreparado[];
  count: number;
  valorTotalAgrupado: number;
  valorTotalBi: number;
  totaisPorConsorcio: ITotalPorConsorcio[];
}

export interface ILimparPreparoResult {
  gruposRemovidos: number;
  ordensDesvinculadas: number;
}

export interface IDetalhamentoPorDia {
  data: string;
  valor: number;
  quantidade: number;
  userId: number;
}

@Injectable()
export class PagamentoConsorcioRepository {
  private logger = new CustomLogger(PagamentoConsorcioRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(DetalheAValorLancamentoAuditoria)
    private auditoriaRepository: Repository<DetalheAValorLancamentoAuditoria>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lista o que já foi preparado hoje (dataPagamento). Quando `dataInicio`/`dataFim` são
   * informados, escopa também pelo período pedido (mesma dataCaptura usada pra agrupar) —
   * sem isso, uma segunda preparação no mesmo dia com um período diferente misturaria os
   * resultados de ambas as chamadas numa lista só. Com `page`/`pageSize`, pagina no banco
   * (essencial pra modais, que podem ter milhares de grupos) e devolve `{data, count}`;
   * sem eles, devolve a lista inteira (uso atual dos consórcios, sempre poucas linhas).
   */
  public async listarPreparados(
    dataPagamento: Date,
    consorcios: string[],
    params: IListarPreparadosParams = {},
  ): Promise<IPagamentoConsorcioPreparado[] | IPagamentoConsorcioPreparadoPaginado> {
    const { dataInicio, dataFim, busca, page, pageSize, gratuidade = false } = params;
    // Agrupamento de Gratuidade navega por "ordemPagamentoAgrupadoGratuidadeId" — independente
    // do agrupamento normal na mesma linha de ordem_pagamento.
    const colunaAgrupamento = gratuidade ? '"ordemPagamentoAgrupadoGratuidadeId"' : '"ordemPagamentoAgrupadoId"';

    // Compara pela data formatada ('YYYY-MM-DD'), não pelo objeto Date bruto: a coluna é
    // timestamp sem timezone gravada sempre à meia-noite exata, e um Date passado direto
    // como parâmetro serializa com as horas UTC do próprio objeto (ex.: 03:00 pra "hoje" em
    // Brasília via getInicioDoDiaBrasilia()), o que nunca bateria com a meia-noite gravada.
    const conditions = [`opa."dataPagamento" = $1`, `op."nomeConsorcio" = ANY($2)`];
    const values: unknown[] = [formatDateISODate(dataPagamento), consorcios];

    if (dataInicio && dataFim) {
      values.push(formatDateISODate(dataInicio), formatDateISODate(dataFim));
      conditions.push(`date_trunc('day', op."dataCaptura") BETWEEN $${values.length - 1} AND $${values.length}`);
    }

    if (busca && busca.trim()) {
      values.push(`%${busca.trim()}%`);
      conditions.push(`u."fullName" ILIKE $${values.length}`);
    }

    const baseQuery = `
      SELECT DISTINCT
        da.id AS "detalheAId",
        op."nomeConsorcio" AS "nomeConsorcio",
        u."fullName" AS "nomeUsuario",
        opa."valorTotal"::float AS "valorAgrupado",
        da."valorLancamento"::float AS "valorBi"
      FROM detalhe_a da
      INNER JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
      INNER JOIN ordem_pagamento_agrupado opa ON opa.id = oph."ordemPagamentoAgrupadoId"
      INNER JOIN ordem_pagamento op ON op.${colunaAgrupamento} = opa.id
      LEFT JOIN "user" u ON u.id = op."userId"
      WHERE ${conditions.join(' AND ')}
    `;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      if (page !== undefined && pageSize !== undefined) {
        const aggregateQuery = `
          SELECT count(*)::int AS "count",
                 coalesce(sum("valorAgrupado"), 0)::float AS "valorTotalAgrupado",
                 coalesce(sum("valorBi"), 0)::float AS "valorTotalBi"
          FROM (${baseQuery}) p
        `;
        const [aggregate] = await queryRunner.query(aggregateQuery, values);

        const totaisPorConsorcioQuery = `
          SELECT "nomeConsorcio",
                 coalesce(sum("valorAgrupado"), 0)::float AS "valorAgrupado",
                 coalesce(sum("valorBi"), 0)::float AS "valorBi"
          FROM (${baseQuery}) p
          GROUP BY "nomeConsorcio"
          ORDER BY "nomeConsorcio" ASC
        `;
        const totaisPorConsorcio: ITotalPorConsorcio[] = await queryRunner.query(totaisPorConsorcioQuery, values);

        const pageValues = [...values, pageSize, (page - 1) * pageSize];
        const paginatedQuery = `
          SELECT * FROM (${baseQuery}) p
          ORDER BY "nomeConsorcio" ASC, "nomeUsuario" ASC
          LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}
        `;
        const data: IPagamentoConsorcioPreparado[] = await queryRunner.query(paginatedQuery, pageValues);

        return {
          data,
          count: aggregate?.count ?? 0,
          valorTotalAgrupado: aggregate?.valorTotalAgrupado ?? 0,
          valorTotalBi: aggregate?.valorTotalBi ?? 0,
          totaisPorConsorcio,
        };
      }

      return await queryRunner.query(`${baseQuery} ORDER BY op."nomeConsorcio" ASC`, values);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Agrupa, por pessoa (userId), todas as ordens de pagamento ainda não agrupadas de um
   * consórcio dentro do período informado — só quando a pessoa tem dados bancários
   * completos cadastrados (bankCode/bankAgency/bankAccount/bankAccountDigit em `user`).
   * Cria uma linha em ordem_pagamento_agrupado (soma dos valores) + ordem_pagamento_agrupado_historico
   * por pessoa, e vincula as ordens agrupadas. Pessoas sem dados bancários ficam de fora
   * (não agrupadas) e são contabilizadas em `semDadosBancarios`.
   */
  /**
   * Agrupamento de GRATUIDADE (pagador CETT): roda na procedure `P_AGRUPAR_ORDENS_CONSORCIO`
   * (ver migrations CreateAgruparOrdensConsorcioProcedure/AddGratuidadeAgruparOrdensConsorcio),
   * porque as procedures da main (`P_AGRUPAR_ORDENS`, usadas no agrupamento normal) não
   * conhecem "valorGratuidade" nem "ordemPagamentoAgrupadoGratuidadeId".
   */
  public async agruparPorConsorcio(
    dataInicio: Date,
    dataFim: Date,
    dataPagamento: Date,
    pagadorId: number,
    consorcio: string,
    gratuidade = false,
  ): Promise<IAgruparPorConsorcioResult> {
    const dtInicioStr = formatDateISODate(dataInicio);
    const dtFimStr = formatDateISODate(dataFim);
    const dtPagamentoStr = formatDateISODate(dataPagamento);

    // Os três últimos placeholders são os parâmetros OUT da procedure — o Postgres exige um
    // argumento posicional pra cada um deles no CALL, mesmo sendo só de saída. Quando
    // `gratuidade` é true, a procedure soma "valorGratuidade" e vincula pelo campo
    // "ordemPagamentoAgrupadoGratuidadeId" em vez de "valor"/"ordemPagamentoAgrupadoId".
    const [resultado] = await this.dataSource.query(
      `CALL P_AGRUPAR_ORDENS_CONSORCIO($1, $2, $3, $4, $5, $6, NULL, NULL, NULL)`,
      [dtInicioStr, dtFimStr, dtPagamentoStr, pagadorId, consorcio, gratuidade],
    );

    return {
      agrupados: Number(resultado?.p_agrupados ?? 0),
      semDadosBancarios: Number(resultado?.p_sem_dados_bancarios ?? 0),
      bloqueados: Number(resultado?.p_bloqueados ?? 0),
    };
  }

  /**
   * As procedures da main (`P_AGRUPAR_ORDENS`) gravam o snapshot bancário no histórico mas
   * não conhecem "userBankAccountType" (fica no default 'corrente'). Este passo copia o tipo
   * de conta atual do usuário pros históricos recém-criados (statusRemessa 0) desse período,
   * pra conta poupança Caixa continuar saindo como poupança no CNAB.
   */
  public async sincronizarTipoContaHistorico(dataPagamento: Date, consorcios: string[], dataInicio: Date, dataFim: Date): Promise<number> {
    const [, afetados] = await this.dataSource.query(
      `
      UPDATE ordem_pagamento_agrupado_historico oph
      SET "userBankAccountType" = u."bankAccountType"
      FROM ordem_pagamento_agrupado opa
      INNER JOIN ordem_pagamento op ON op."ordemPagamentoAgrupadoId" = opa.id
      INNER JOIN "user" u ON u.id = op."userId"
      WHERE oph."ordemPagamentoAgrupadoId" = opa.id
        AND opa."dataPagamento" = $1
        AND op."nomeConsorcio" = ANY($2)
        AND date_trunc('day', op."dataCaptura") BETWEEN $3 AND $4
        AND oph."statusRemessa" = 0
        AND oph."userBankAccountType" IS DISTINCT FROM u."bankAccountType"
      `,
      [formatDateISODate(dataPagamento), consorcios, formatDateISODate(dataInicio), formatDateISODate(dataFim)],
    );
    return Number(afetados ?? 0);
  }

  /**
   * Desfaz completamente o preparo atual (dataPagamento = hoje) dos consórcios: apaga o
   * DetalheA/DetalheB gerados, o histórico e o agrupamento, e devolve as ordens ao estado
   * "não agrupada" (ordemPagamentoAgrupadoId = NULL), para permitir preparar de novo do zero.
   * Só atua sobre grupos ainda em statusRemessa=PreparadoParaEnvio (nunca chegaram a ser
   * enviados/retornados pelo banco, já que esse fluxo não gera CNAB nem envia por SFTP) —
   * nunca remove grupos com retorno real do banco já processado.
   */
  public async limparPreparo(dataPagamento: Date, consorcios: string[]): Promise<ILimparPreparoResult> {
    const dtPagamentoStr = formatDateISODate(dataPagamento);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const registros: { detalheAId: number; opaId: number; headerLoteId: number; headerArquivoId: number }[] = await queryRunner.query(
        `
        SELECT DISTINCT
          da.id AS "detalheAId",
          opa.id AS "opaId",
          da."headerLoteId" AS "headerLoteId",
          hl."headerArquivoId" AS "headerArquivoId"
        FROM detalhe_a da
        INNER JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
        INNER JOIN ordem_pagamento_agrupado opa ON opa.id = oph."ordemPagamentoAgrupadoId"
        INNER JOIN header_lote hl ON hl.id = da."headerLoteId"
        INNER JOIN ordem_pagamento op ON op."ordemPagamentoAgrupadoId" = opa.id
        WHERE opa."dataPagamento" = $1
          AND op."nomeConsorcio" = ANY($2)
          AND oph."statusRemessa" = $3
        `,
        [dtPagamentoStr, consorcios, StatusRemessaEnum.PreparadoParaEnvio],
      );

      if (registros.length === 0) {
        await queryRunner.commitTransaction();
        return { gruposRemovidos: 0, ordensDesvinculadas: 0 };
      }

      const detalheAIds = [...new Set(registros.map((r) => r.detalheAId))];
      const opaIds = [...new Set(registros.map((r) => r.opaId))];
      const headerLoteIds = [...new Set(registros.map((r) => r.headerLoteId))];
      const headerArquivoIds = [...new Set(registros.map((r) => r.headerArquivoId))];

      await queryRunner.query(`DELETE FROM detalhe_a_valor_lancamento_auditoria WHERE "detalheAId" = ANY($1)`, [detalheAIds]);
      await queryRunner.query(`DELETE FROM detalhe_b WHERE "detalheAId" = ANY($1)`, [detalheAIds]);
      await queryRunner.query(`DELETE FROM detalhe_a WHERE id = ANY($1)`, [detalheAIds]);

      const ordensDesvinculadas: { id: number }[] = await queryRunner.query(
        `UPDATE ordem_pagamento SET "ordemPagamentoAgrupadoId" = NULL WHERE "ordemPagamentoAgrupadoId" = ANY($1) RETURNING id`,
        [opaIds],
      );

      await queryRunner.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" = ANY($1)`, [opaIds]);
      await queryRunner.query(`DELETE FROM ordem_pagamento_agrupado WHERE id = ANY($1)`, [opaIds]);

      // Header lote/arquivo só são removidos se ficarem órfãos (sem nenhum outro DetalheA),
      // já que um mesmo headerArquivo pode ser reaproveitado por outras preparações do dia.
      for (const headerLoteId of headerLoteIds) {
        const remaining: { count: string }[] = await queryRunner.query(`SELECT count(*) AS count FROM detalhe_a WHERE "headerLoteId" = $1`, [headerLoteId]);
        if (Number(remaining[0].count) === 0) {
          await queryRunner.query(`DELETE FROM header_lote WHERE id = $1`, [headerLoteId]);
        }
      }
      for (const headerArquivoId of headerArquivoIds) {
        const remaining: { count: string }[] = await queryRunner.query(`SELECT count(*) AS count FROM header_lote WHERE "headerArquivoId" = $1`, [
          headerArquivoId,
        ]);
        if (Number(remaining[0].count) === 0) {
          await queryRunner.query(`DELETE FROM header_arquivo WHERE id = $1`, [headerArquivoId]);
        }
      }

      await queryRunner.commitTransaction();
      return { gruposRemovidos: opaIds.length, ordensDesvinculadas: ordensDesvinculadas.length };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Detalha, dia a dia (dataCaptura, o mesmo campo usado para agrupar), quanto foi somado
   * no Valor Agrupado de um grupo — ex.: 18/09 = R$50, 19/09 = R$50, totalizando R$100.
   */
  public async detalharPorDia(detalheAId: number): Promise<IDetalhamentoPorDia[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      // O DetalheA pode ter sido gerado tanto pelo agrupamento normal quanto pelo de
      // Gratuidade (agrupamentos independentes, cada um com seu próprio historico) — por
      // isso casa por qualquer um dos dois FKs e escolhe a coluna de valor certa por linha.
      return await queryRunner.query(
        `
        WITH alvo AS (
          SELECT oph."ordemPagamentoAgrupadoId" AS opa_id
          FROM detalhe_a da
          INNER JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
          WHERE da.id = $1
        )
        SELECT
          date_trunc('day', op."dataCaptura")::date AS "data",
          SUM(CASE WHEN op."ordemPagamentoAgrupadoGratuidadeId" = alvo.opa_id THEN op."valorGratuidade" ELSE op.valor END)::float AS "valor",
          count(*)::int AS "quantidade",
          op."userId" AS "userId"
        FROM ordem_pagamento op, alvo
        WHERE op."ordemPagamentoAgrupadoId" = alvo.opa_id OR op."ordemPagamentoAgrupadoGratuidadeId" = alvo.opa_id
        GROUP BY 1, op."userId"
        ORDER BY 1
        `,
        [detalheAId],
      );
    } finally {
      await queryRunner.release();
    }
  }

  public async registrarAuditoria(detalheAId: number, userId: number, valorAnterior: number, valorNovo: number): Promise<DetalheAValorLancamentoAuditoria> {
    const entity = this.auditoriaRepository.create({ detalheAId, userId, valorAnterior, valorNovo });
    return this.auditoriaRepository.save(entity);
  }

  public async listarAuditoria(detalheAId: number): Promise<DetalheAValorLancamentoAuditoria[]> {
    return this.auditoriaRepository.find({
      where: { detalheAId },
      order: { createdAt: 'DESC' },
    });
  }
}
