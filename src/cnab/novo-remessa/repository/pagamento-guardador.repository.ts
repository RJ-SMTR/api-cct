import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { formatDateISODate } from 'src/utils/date-utils';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { DetalheAValorLancamentoAuditoria } from 'src/cnab/entity/pagamento/detalhe-a-valor-lancamento-auditoria.entity';
import {
  IDetalhamentoPorDia,
  ILimparPreparoResult,
  IListarPreparadosParams,
} from './pagamento-consorcio.repository';

export interface IPagamentoGuardadorPreparado {
  detalheAId: number;
  nomeConsorcio: string;
  nomeUsuario: string | null;
  valorAgrupado: number;
  valorBi: number;
}

export interface IPagamentoGuardadorPreparadoPaginado {
  data: IPagamentoGuardadorPreparado[];
  count: number;
  valorTotalAgrupado: number;
  valorTotalBi: number;
}

export interface IAgruparGuardadorResult {
  agrupados: number;
  semDadosBancarios: number;
  bloqueados: number;
}

interface IGrupoPorUsuario {
  userId: number;
  valorTotal: string;
  orderIds: number[];
  bankCode: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountDigit: string | null;
  bloqueado: boolean | null;
}

/**
 * Mesma ideia do PagamentoConsorcioRepository, mas para `ordem_pagamento_guardador` — uma
 * tabela própria (não `ordem_pagamento`), sem conceito de consórcio, com `dataOrdem` no
 * lugar de `dataCaptura` e `valorRepasseGuardador` no lugar de `valor`. Por isso não dá pra
 * simplesmente reaproveitar o repositório de consórcio/modal (como o de Modais faz, já que
 * Modais usa a MESMA tabela `ordem_pagamento`, só com outros nomes de consórcio).
 */
@Injectable()
export class PagamentoGuardadorRepository {
  private logger = new CustomLogger(PagamentoGuardadorRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(DetalheAValorLancamentoAuditoria)
    private auditoriaRepository: Repository<DetalheAValorLancamentoAuditoria>,
    private readonly dataSource: DataSource,
  ) {}

  public async listarPreparados(
    dataPagamento: Date,
    params: IListarPreparadosParams = {},
  ): Promise<IPagamentoGuardadorPreparado[] | IPagamentoGuardadorPreparadoPaginado> {
    const { dataInicio, dataFim, busca, page, pageSize } = params;

    // Compara pela data formatada, não pelo Date bruto — ver comentário equivalente em
    // PagamentoConsorcioRepository.listarPreparados.
    const conditions = [`opa."dataPagamento" = $1`];
    const values: unknown[] = [formatDateISODate(dataPagamento)];

    if (dataInicio && dataFim) {
      values.push(formatDateISODate(dataInicio), formatDateISODate(dataFim));
      conditions.push(`date_trunc('day', op."dataOrdem") BETWEEN $${values.length - 1} AND $${values.length}`);
    }

    if (busca && busca.trim()) {
      values.push(`%${busca.trim()}%`);
      conditions.push(`u."fullName" ILIKE $${values.length}`);
    }

    const baseQuery = `
      SELECT DISTINCT
        da.id AS "detalheAId",
        'Guardador' AS "nomeConsorcio",
        u."fullName" AS "nomeUsuario",
        opa."valorTotal"::float AS "valorAgrupado",
        da."valorLancamento"::float AS "valorBi"
      FROM detalhe_a da
      INNER JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
      INNER JOIN ordem_pagamento_agrupado opa ON opa.id = oph."ordemPagamentoAgrupadoId"
      INNER JOIN ordem_pagamento_guardador op ON op."ordemPagamentoAgrupadoId" = opa.id
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

        const pageValues = [...values, pageSize, (page - 1) * pageSize];
        const paginatedQuery = `
          SELECT * FROM (${baseQuery}) p
          ORDER BY "nomeUsuario" ASC
          LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}
        `;
        const data: IPagamentoGuardadorPreparado[] = await queryRunner.query(paginatedQuery, pageValues);

        return {
          data,
          count: aggregate?.count ?? 0,
          valorTotalAgrupado: aggregate?.valorTotalAgrupado ?? 0,
          valorTotalBi: aggregate?.valorTotalBi ?? 0,
        };
      }

      return await queryRunner.query(`${baseQuery} ORDER BY "nomeUsuario" ASC`, values);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Agrupa, por pessoa (userId), todas as ordens de guardador ainda não agrupadas no período
   * informado — só quem tem dados bancários completos e não está bloqueado (mesma regra dos
   * consórcios/modais). Bulk insert em blocos, igual ao `agruparPorConsorcio`.
   */
  public async agruparGuardador(dataInicio: Date, dataFim: Date, dataPagamento: Date, pagadorId: number): Promise<IAgruparGuardadorResult> {
    const dtInicioStr = formatDateISODate(dataInicio);
    const dtFimStr = formatDateISODate(dataFim);
    const dtPagamentoStr = formatDateISODate(dataPagamento);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const grupos: IGrupoPorUsuario[] = await queryRunner.query(
        `
        SELECT op."userId" AS "userId",
               SUM(op."valorRepasseGuardador") AS "valorTotal",
               ARRAY_AGG(op.id) AS "orderIds",
               u."bankCode" AS "bankCode",
               u."bankAgency" AS "bankAgency",
               u."bankAccount" AS "bankAccount",
               u."bankAccountDigit" AS "bankAccountDigit",
               u."bloqueado" AS "bloqueado"
        FROM ordem_pagamento_guardador op
        INNER JOIN "user" u ON u.id = op."userId"
        WHERE op."ordemPagamentoAgrupadoId" IS NULL
          AND op."userId" IS NOT NULL
          AND date_trunc('day', op."dataOrdem") BETWEEN $1 AND $2
        GROUP BY op."userId", u."bankCode", u."bankAgency", u."bankAccount", u."bankAccountDigit", u."bloqueado"
        `,
        [dtInicioStr, dtFimStr],
      );

      let semDadosBancarios = 0;
      let bloqueados = 0;
      const elegiveis: IGrupoPorUsuario[] = [];

      for (const grupo of grupos) {
        if (grupo.bloqueado) {
          bloqueados += 1;
          this.logger.warn(`Usuário ${grupo.userId} bloqueado, não agrupado (guardador)`);
          continue;
        }

        const temDadosBancarios = Boolean(grupo.bankCode) && Boolean(grupo.bankAgency) && Boolean(grupo.bankAccount) && Boolean(grupo.bankAccountDigit);
        if (!temDadosBancarios) {
          semDadosBancarios += 1;
          this.logger.warn(`Usuário ${grupo.userId} sem dados bancários completos, não agrupado (guardador)`);
          continue;
        }

        elegiveis.push(grupo);
      }

      const TAMANHO_BLOCO = 500;
      for (let inicio = 0; inicio < elegiveis.length; inicio += TAMANHO_BLOCO) {
        const bloco = elegiveis.slice(inicio, inicio + TAMANHO_BLOCO);

        const insertAgrupadoValues: string[] = [];
        const insertAgrupadoParams: unknown[] = [];
        for (const grupo of bloco) {
          const p = insertAgrupadoParams.length;
          insertAgrupadoValues.push(`(nextval('ordem_pagamento_agrupado_id_seq'), $${p + 1}, $${p + 2}, now(), now(), $${p + 3})`);
          insertAgrupadoParams.push(dtPagamentoStr, grupo.valorTotal, pagadorId);
        }

        const opaRows: { id: number }[] = await queryRunner.query(
          `
          INSERT INTO ordem_pagamento_agrupado (id, "dataPagamento", "valorTotal", "createdAt", "updatedAt", "pagadorId")
          VALUES ${insertAgrupadoValues.join(', ')}
          RETURNING id
          `,
          insertAgrupadoParams,
        );
        const opaIds = opaRows.map((r) => r.id);

        const updateValues: string[] = [];
        const updateParams: unknown[] = [];
        bloco.forEach((grupo, idx) => {
          const opaId = opaIds[idx];
          for (const orderId of grupo.orderIds) {
            const p = updateParams.length;
            updateValues.push(`($${p + 1}::int, $${p + 2}::int)`);
            updateParams.push(orderId, opaId);
          }
        });
        if (updateValues.length > 0) {
          await queryRunner.query(
            `
            UPDATE ordem_pagamento_guardador op
            SET "ordemPagamentoAgrupadoId" = v.opa_id
            FROM (VALUES ${updateValues.join(', ')}) AS v(order_id, opa_id)
            WHERE op.id = v.order_id
            `,
            updateParams,
          );
        }

        const insertHistValues: string[] = [];
        const insertHistParams: unknown[] = [];
        bloco.forEach((grupo, idx) => {
          const opaId = opaIds[idx];
          const p = insertHistParams.length;
          insertHistValues.push(`(nextval('ordem_pagamento_agrupado_historico_id_seq'), $${p + 1}, now(), $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6})`);
          insertHistParams.push(opaId, grupo.bankAccountDigit, grupo.bankAccount, grupo.bankAgency, String(grupo.bankCode), StatusRemessaEnum.Criado);
        });
        await queryRunner.query(
          `
          INSERT INTO ordem_pagamento_agrupado_historico
            (id, "ordemPagamentoAgrupadoId", "dataReferencia", "userBankAccountDigit", "userBankAccount", "userBankAgency", "userBankCode", "statusRemessa")
          VALUES ${insertHistValues.join(', ')}
          `,
          insertHistParams,
        );
      }

      const agrupados = elegiveis.length;

      await queryRunner.commitTransaction();
      return { agrupados, semDadosBancarios, bloqueados };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Desfaz o preparo atual (dataPagamento = hoje) do guardador — mesma ideia do
   * `limparPreparo` de consórcio/modal, só que sem filtro de consórcio (não existe aqui) e
   * juntando por `ordem_pagamento_guardador`.
   */
  public async limparPreparo(dataPagamento: Date): Promise<ILimparPreparoResult> {
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
        INNER JOIN ordem_pagamento_guardador op ON op."ordemPagamentoAgrupadoId" = opa.id
        WHERE opa."dataPagamento" = $1
          AND oph."statusRemessa" = $2
        `,
        [dtPagamentoStr, StatusRemessaEnum.PreparadoParaEnvio],
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
        `UPDATE ordem_pagamento_guardador SET "ordemPagamentoAgrupadoId" = NULL WHERE "ordemPagamentoAgrupadoId" = ANY($1) RETURNING id`,
        [opaIds],
      );

      await queryRunner.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" = ANY($1)`, [opaIds]);
      await queryRunner.query(`DELETE FROM ordem_pagamento_agrupado WHERE id = ANY($1)`, [opaIds]);

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

  public async detalharPorDia(detalheAId: number): Promise<IDetalhamentoPorDia[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      return await queryRunner.query(
        `
        SELECT
          date_trunc('day', op."dataOrdem")::date AS "data",
          SUM(op."valorRepasseGuardador")::float AS "valor",
          count(*)::int AS "quantidade",
          op."userId" AS "userId"
        FROM ordem_pagamento_guardador op
        WHERE op."ordemPagamentoAgrupadoId" = (
          SELECT oph."ordemPagamentoAgrupadoId"
          FROM detalhe_a da
          INNER JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
          WHERE da.id = $1
        )
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
