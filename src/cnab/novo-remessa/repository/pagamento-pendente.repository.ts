import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { formatDateISODate } from 'src/utils/date-utils';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';
import { IDetalhamentoPorDia, ILimparPreparoResult } from './pagamento-consorcio.repository';

export type TipoPendente = 'permissionarios' | 'guardadores';

export interface IPagamentoPendentePreparado {
  detalheAId: number;
  nomeConsorcio: string;
  nomeUsuario: string | null;
  valorAgrupado: number;
  valorBi: number;
}

/** Modais: as procedures de pendentes só tratam estes consórcios (STPC, STPL, TEC). */
export const MODAIS_PENDENTES = ['STPC', 'STPL', 'TEC'];
/**
 * Pendentes: as procedures `P_AGRUPAR_ORDENS_CONSORCIO_PENDENTES` / `P_AGRUPAR_ORDENS_GUARDADOR_PENDENTE` criam um
 * agrupamento "pai" (dataPagamento = dia do preparo) que soma agrupamentos anteriores que falharam (as "filhas",
 * ligadas pelo `ordemPagamentoAgrupadoId` do agrupamento). Ordens nunca agrupadas ganham, na mesma execução, um
 * agrupamento próprio (dataPagamento = dia do preparo) que também vira filha. O remessa é gerado sobre o histórico do
 * pai, que é o único com filhas; agrupamentos normais nunca têm filhas e, por isso, nunca são tocados aqui.
 */
@Injectable()
export class PagamentoPendenteRepository {
  constructor(private readonly dataSource: DataSource) {}

  private tabela(tipo: TipoPendente) {
    return tipo === 'permissionarios'
      ? { nome: 'ordem_pagamento', colunaData: '"dataCaptura"', filtro: `AND o."nomeConsorcio" = ANY($2)`, grupo: `o."nomeConsorcio"` }
      : { nome: 'ordem_pagamento_guardador', colunaData: '"dataOrdem"', filtro: `AND $2::text[] IS NOT NULL`, grupo: `'Guardador'::text` };
  }

  /**
   * CTEs até `pais`: agrupamentos pendentes do dia (um por usuário), com um usuário/grupo de referência e a lista de
   * agrupamentos filhos. Usa os parâmetros $1 (data de pagamento 'YYYY-MM-DD') e $2 (consórcios). Parte só dos
   * agrupamentos do pagador do dia (poucos) e lê a tabela de ordens uma vez, em vez de uma consulta por agrupamento.
   */
  private ctePais(tipo: TipoPendente) {
    const t = this.tabela(tipo);
    const contaPagador = tipo === 'permissionarios' ? PagadorContaEnum.ContaBilhetagem : PagadorContaEnum.ContaRotativo;
    return `
      cand AS (
        SELECT opa.id, opa."valorTotal" AS valor_total
          FROM ordem_pagamento_agrupado opa
         WHERE opa."dataPagamento" = $1::date
           AND opa."pagadorId" IN (SELECT id FROM pagador WHERE conta = '${contaPagador}')
      ),
      vinculos AS (
        SELECT c.id AS pai_id, ch.id AS filha_id
          FROM cand c JOIN ordem_pagamento_agrupado ch ON ch."ordemPagamentoAgrupadoId" = c.id
      ),
      pais AS (
        SELECT c.id AS opa_id, c.valor_total,
               (array_agg(DISTINCT o."userId"))[1] AS user_id,
               (array_agg(DISTINCT ${t.grupo}))[1] AS grupo,
               array_agg(DISTINCT v.filha_id) AS filhas
          FROM cand c
          JOIN vinculos v ON v.pai_id = c.id
          JOIN ${t.nome} o ON o."ordemPagamentoAgrupadoId" = v.filha_id
         WHERE TRUE ${t.filtro}
         GROUP BY c.id, c.valor_total
      )`;
  }

  async listarPreparados(tipo: TipoPendente, dataPagamento: Date): Promise<IPagamentoPendentePreparado[]> {
    return this.dataSource.query(
      `WITH ${this.ctePais(tipo)}
       SELECT DISTINCT da.id AS "detalheAId", p.grupo AS "nomeConsorcio", u."fullName" AS "nomeUsuario",
              p.valor_total::float AS "valorAgrupado", da."valorLancamento"::float AS "valorBi"
         FROM pais p
         JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = p.opa_id
         JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
         LEFT JOIN "user" u ON u.id = p.user_id
        WHERE oph."statusRemessa" IN ($3, $4)
        ORDER BY "nomeConsorcio", "nomeUsuario"`,
      [formatDateISODate(dataPagamento), MODAIS_PENDENTES, StatusRemessaEnum.Criado, StatusRemessaEnum.PreparadoParaEnvio],
    );
  }

  /** As procedures não conhecem `userBankAccountType` (poupança Caixa): copia do usuário para os históricos novos. */
  async sincronizarTipoContaHistorico(tipo: TipoPendente, dataPagamento: Date): Promise<number> {
    const [, afetados] = await this.dataSource.query(
      `WITH ${this.ctePais(tipo)}
       UPDATE ordem_pagamento_agrupado_historico oph
          SET "userBankAccountType" = u."bankAccountType"
         FROM pais p
         JOIN "user" u ON u.id = p.user_id
        WHERE oph."ordemPagamentoAgrupadoId" = p.opa_id
          AND oph."statusRemessa" = $3
          AND oph."userBankAccountType" IS DISTINCT FROM u."bankAccountType"`,
      [formatDateISODate(dataPagamento), MODAIS_PENDENTES, StatusRemessaEnum.Criado],
    );
    return Number(afetados ?? 0);
  }

  /** Dia a dia (data da ordem) do que foi somado no agrupamento pendente, incluindo as filhas. */
  async detalharPorDia(tipo: TipoPendente, detalheAId: number): Promise<IDetalhamentoPorDia[]> {
    const t = this.tabela(tipo);
    return this.dataSource.query(
      `WITH alvo AS (
         SELECT oph."ordemPagamentoAgrupadoId" AS pai_id
           FROM detalhe_a da JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
          WHERE da.id = $1),
       alvos AS (
         SELECT pai_id AS id FROM alvo
         UNION SELECT ch.id FROM ordem_pagamento_agrupado ch JOIN alvo ON ch."ordemPagamentoAgrupadoId" = alvo.pai_id)
       SELECT date_trunc('day', o.${t.colunaData})::date AS "data",
              SUM(${tipo === 'permissionarios' ? 'o.valor' : 'o."valorRepasseGuardador"'})::float AS "valor",
              count(*)::int AS "quantidade", o."userId" AS "userId"
         FROM ${t.nome} o
        WHERE o."ordemPagamentoAgrupadoId" IN (SELECT id FROM alvos)
        GROUP BY 1, o."userId"
        ORDER BY 1`,
      [detalheAId],
    );
  }

  /**
   * Desfaz o preparo de pendentes do dia: remove DetalheA/B e históricos dos pais, solta as filhas (voltam a ser
   * pendentes) ou desvincula as ordens nunca pagas, e apaga os pais. Só atua em pais que ainda não foram enviados
   * ao banco (históricos Criado / PreparadoParaEnvio).
   */
  async limparPreparo(tipo: TipoPendente, dataPagamento: Date): Promise<ILimparPreparoResult> {
    const t = this.tabela(tipo);
    const dtPagamento = formatDateISODate(dataPagamento);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const pais: { opa_id: number; filhas: number[] }[] = await qr.query(
        `WITH ${this.ctePais(tipo)}
         SELECT p.opa_id, p.filhas FROM pais p
          WHERE NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado_historico h
                             WHERE h."ordemPagamentoAgrupadoId" = p.opa_id AND h."statusRemessa" NOT IN ($3, $4))`,
        [dtPagamento, MODAIS_PENDENTES, StatusRemessaEnum.Criado, StatusRemessaEnum.PreparadoParaEnvio],
      );
      if (pais.length === 0) {
        await qr.commitTransaction();
        return { gruposRemovidos: 0, ordensDesvinculadas: 0 };
      }
      const paiIds = pais.map((p) => p.opa_id);
      const filhaIds = [...new Set(pais.flatMap((p) => p.filhas.map(Number)))];

      const detalhes: { id: number; headerLoteId: number; headerArquivoId: number }[] = await qr.query(
        `SELECT DISTINCT da.id, da."headerLoteId", hl."headerArquivoId"
           FROM detalhe_a da
           JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
           JOIN header_lote hl ON hl.id = da."headerLoteId"
          WHERE oph."ordemPagamentoAgrupadoId" = ANY($1)`,
        [paiIds],
      );
      const detalheIds = detalhes.map((d) => d.id);
      if (detalheIds.length) {
        await qr.query(`DELETE FROM detalhe_a_valor_lancamento_auditoria WHERE "detalheAId" = ANY($1)`, [detalheIds]);
        await qr.query(`DELETE FROM detalhe_b WHERE "detalheAId" = ANY($1)`, [detalheIds]);
        await qr.query(`DELETE FROM detalhe_a WHERE id = ANY($1)`, [detalheIds]);
      }

      // Filhas criadas SÓ por este preparo (ordens que nunca tinham sido agrupadas) são desfeitas por completo e as
      // ordens voltam a ficar soltas. Só vale para agrupamento sem nenhum pagamento (detalhe A) e só com histórico
      // "Criado": o pagamento normal do dia (dataPagamento = hoje, já enviado) também pode ter sido "adotado" como filha
      // por uma pendência antiga e NUNCA pode ser apagado — ele só deixa de ter pai. Decidido ANTES de mexer nos históricos.
      const novas: { id: number }[] = filhaIds.length
        ? await qr.query(
            `SELECT a.id FROM ordem_pagamento_agrupado a
              WHERE a.id = ANY($1) AND a."dataPagamento"::date = $2::date
                AND NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado_historico h JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = h.id
                                 WHERE h."ordemPagamentoAgrupadoId" = a.id)
                AND NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado_historico h WHERE h."ordemPagamentoAgrupadoId" = a.id AND h."statusRemessa" <> $3)`,
            [filhaIds, dtPagamento, StatusRemessaEnum.Criado],
          )
        : [];
      const novaIds = novas.map((n) => n.id);

      // Históricos "Criado" (sem pagamento) que a procedure abriu para as filhas que já existiam neste preparo.
      if (filhaIds.length) {
        await qr.query(
          `DELETE FROM ordem_pagamento_agrupado_historico h
            WHERE h."ordemPagamentoAgrupadoId" = ANY($1) AND h."statusRemessa" = $2 AND h."dataReferencia"::date = $3::date
              AND NOT EXISTS (SELECT 1 FROM detalhe_a da WHERE da."ordemPagamentoAgrupadoHistoricoId" = h.id)`,
          [filhaIds, StatusRemessaEnum.Criado, dtPagamento],
        );
        await qr.query(`UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id = ANY($1)`, [filhaIds]);
      }
      let desvinculadas: { id: number }[] = [];
      if (novaIds.length) {
        desvinculadas = await qr.query(`UPDATE ${t.nome} SET "ordemPagamentoAgrupadoId" = NULL WHERE "ordemPagamentoAgrupadoId" = ANY($1) RETURNING id`, [novaIds]);
        await qr.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" = ANY($1)`, [novaIds]);
        await qr.query(`DELETE FROM ordem_pagamento_agrupado WHERE id = ANY($1)`, [novaIds]);
      }
      await qr.query(`DELETE FROM ordem_pagamento_agrupado_historico WHERE "ordemPagamentoAgrupadoId" = ANY($1)`, [paiIds]);
      await qr.query(`DELETE FROM ordem_pagamento_agrupado WHERE id = ANY($1)`, [paiIds]);

      for (const headerLoteId of [...new Set(detalhes.map((d) => d.headerLoteId))]) {
        const [{ count }] = await qr.query(`SELECT count(*) AS count FROM detalhe_a WHERE "headerLoteId" = $1`, [headerLoteId]);
        if (Number(count) === 0) await qr.query(`DELETE FROM header_lote WHERE id = $1`, [headerLoteId]);
      }
      for (const headerArquivoId of [...new Set(detalhes.map((d) => d.headerArquivoId))]) {
        const [{ count }] = await qr.query(`SELECT count(*) AS count FROM header_lote WHERE "headerArquivoId" = $1`, [headerArquivoId]);
        if (Number(count) === 0) await qr.query(`DELETE FROM header_arquivo WHERE id = $1`, [headerArquivoId]);
      }

      await qr.commitTransaction();
      return { gruposRemovidos: paiIds.length, ordensDesvinculadas: desvinculadas.length };
    } catch (error) {
      await qr.rollbackTransaction();
      throw error;
    } finally {
      await qr.release();
    }
  }
}
