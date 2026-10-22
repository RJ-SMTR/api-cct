import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type SituacaoIndevido = 'devendo' | 'quitado';

export interface FiltroPagamentosIndevidos {
  /** Parte do nome ou do CPF/CNPJ (só dígitos) do guardador. */
  busca?: string;
  situacao?: SituacaoIndevido;
  page?: number;
  pageSize?: number;
}

export interface LinhaPagamentoIndevido {
  id: number;
  userId: number | null;
  guardador: string;
  cpfCnpj: string | null;
  /** Data da última movimentação do débito (último desconto ou lançamento do indevido). */
  dataReferencia: string | null;
  valorPago: string;
  valorPagar: string;
  /** O que foi pago a mais: valorPago - valorPagar. */
  valorIndevido: string;
  /** Quanto do indevido já foi descontado: valorIndevido - saldoDevedor. */
  valorDebitado: string;
  /** O que o guardador ainda deve. */
  saldoDevedor: string;
  situacao: SituacaoIndevido;
}

export interface TotaisPagamentosIndevidos {
  quantidade: number;
  devendo: number;
  valorIndevido: string;
  valorDebitado: string;
  saldoDevedor: string;
}

/** Pagamento em que o guardador recebeu menos que o devido (abatimento do indevido): devido, pago e diferença. */
export interface LancamentoIndevido {
  /** Data do pagamento (AAAA-MM-DD). */
  data: string;
  valorDevido: string;
  valorPago: string;
  /** valorPago - valorDevido (negativa quando houve abatimento). */
  diferenca: string;
  statusRemessa: number;
}

export interface IndevidoDoGuardador {
  totais: TotaisPagamentosIndevidos;
  lancamentos: LancamentoIndevido[];
  /** Datas (AAAA-MM-DD) dos pagamentos em duplicidade: da segunda vez em diante que a mesma ordem foi paga. */
  datasDuplicidade: string[];
}

const LIMITE_EXPORTACAO = 5000;
/** Guardadores são os usuários cujo permitCode tem no máximo este tamanho. */
export const PERMIT_CODE_MAX_GUARDADOR = 4;

/**
 * Pagamentos indevidos dos guardadores (tabela `pagamento_indevido`): o que foi pago a mais, quanto já foi
 * debitado e quanto o guardador ainda deve. Só entram guardadores (permitCode com até 4 caracteres). O guardador é identificado pelo nome (a tabela não guarda o usuário).
 */
@Injectable()
export class PagamentosIndevidosGuardadoresService {
  constructor(private readonly dataSource: DataSource) {}

  private cte() {
    return `
      base AS (
        SELECT pi.id, u.id AS user_id, pi."nomeFavorecido" AS guardador, u."cpfCnpj" AS cpf_cnpj,
               pi."dataReferencia", pi."valorPago", COALESCE(pi."valorPagar", 0) AS valor_pagar,
               GREATEST(COALESCE(pi."valorPago", 0) - COALESCE(pi."valorPagar", 0), 0) AS indevido,
               COALESCE(pi."saldoDevedor", 0) AS saldo
          FROM pagamento_indevido pi
          LEFT JOIN LATERAL (
            SELECT id, "cpfCnpj", "permitCode" FROM "user"
             WHERE upper(trim("fullName")) = upper(trim(pi."nomeFavorecido"))
             ORDER BY id LIMIT 1
          ) u ON true
         -- guardador = usuário com permitCode de até 4 caracteres (os demais permissionários têm código maior)
         WHERE length(u."permitCode") <= ${PERMIT_CODE_MAX_GUARDADOR}
      ),
      calculado AS (
        SELECT *, GREATEST(indevido - saldo, 0) AS debitado,
               CASE WHEN saldo > 0 THEN 'devendo' ELSE 'quitado' END AS situacao
          FROM base
      )`;
  }

  private where(filtro: FiltroPagamentosIndevidos, params: unknown[]) {
    const condicoes: string[] = [];
    const busca = filtro.busca?.trim();
    if (busca) {
      params.push(`%${busca}%`);
      const nome = `$${params.length}`;
      const digitos = busca.replace(/\D/g, '');
      if (digitos.length >= 3) {
        params.push(`%${digitos}%`);
        condicoes.push(`(guardador ILIKE ${nome} OR regexp_replace(COALESCE(cpf_cnpj, ''), '\\D', '', 'g') LIKE $${params.length})`);
      } else {
        condicoes.push(`guardador ILIKE ${nome}`);
      }
    }
    if (filtro.situacao === 'devendo' || filtro.situacao === 'quitado') {
      params.push(filtro.situacao);
      condicoes.push(`situacao = $${params.length}`);
    }
    return condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  }

  private colunas() {
    return `id, user_id AS "userId", guardador, cpf_cnpj AS "cpfCnpj", to_char("dataReferencia", 'YYYY-MM-DD') AS "dataReferencia",
            "valorPago"::numeric(18,2)::text AS "valorPago", valor_pagar::numeric(18,2)::text AS "valorPagar",
            indevido::numeric(18,2)::text AS "valorIndevido", debitado::numeric(18,2)::text AS "valorDebitado",
            saldo::numeric(18,2)::text AS "saldoDevedor", situacao`;
  }

  async listar(filtro: FiltroPagamentosIndevidos): Promise<{ total: number; page: number; pageSize: number; totais: TotaisPagamentosIndevidos; itens: LinhaPagamentoIndevido[] }> {
    const page = Math.max(1, Math.floor(Number(filtro.page)) || 1);
    const pageSize = Math.min(200, Math.max(1, Math.floor(Number(filtro.pageSize)) || 50));
    const params: unknown[] = [];
    const where = this.where(filtro, params);

    const [totais] = await this.dataSource.query(
      `WITH ${this.cte()}
       SELECT count(*)::int AS quantidade, count(*) FILTER (WHERE situacao = 'devendo')::int AS devendo,
              COALESCE(sum(indevido), 0)::numeric(18,2)::text AS "valorIndevido",
              COALESCE(sum(debitado), 0)::numeric(18,2)::text AS "valorDebitado",
              COALESCE(sum(saldo), 0)::numeric(18,2)::text AS "saldoDevedor"
         FROM calculado ${where}`,
      params,
    );
    const itens = await this.dataSource.query(
      `WITH ${this.cte()}
       SELECT ${this.colunas()} FROM calculado ${where}
       ORDER BY saldo DESC, "dataReferencia" DESC NULLS LAST, id DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params,
    );
    return { total: totais.quantidade, page, pageSize, totais, itens };
  }

  /**
   * Indevido de UM guardador (para o quadro da tela do guardador): as linhas dele e os totais. O quadro só aparece quando
   * `totais.saldoDevedor` é maior que zero. Guardador desconhecido ou sem linhas devolve totais zerados e lista vazia.
   */
  async porUsuario(userId: number): Promise<IndevidoDoGuardador> {
    const params = [userId];
    const [totais] = await this.dataSource.query(
      `WITH ${this.cte()}
       SELECT count(*)::int AS quantidade, count(*) FILTER (WHERE situacao = 'devendo')::int AS devendo,
              COALESCE(sum(indevido), 0)::numeric(18,2)::text AS "valorIndevido",
              COALESCE(sum(debitado), 0)::numeric(18,2)::text AS "valorDebitado",
              COALESCE(sum(saldo), 0)::numeric(18,2)::text AS "saldoDevedor"
         FROM calculado WHERE user_id = $1`,
      params,
    );
    // Sem saldo devedor o quadro não aparece: poupa as consultas abaixo.
    if (!(Number(totais?.saldoDevedor) > 0)) {
      return { totais, lancamentos: [], datasDuplicidade: [] };
    }

    // Pagamentos em que o guardador recebeu menos que o devido. O pagamento pode estar no agrupamento da ordem ou no PAI dele
    // (pendência), por isso o devido soma as ordens do guardador de qualquer um dos dois.
    const lancamentos: LancamentoIndevido[] = await this.dataSource.query(
      `WITH meus AS (
         SELECT g."ordemPagamentoAgrupadoId" AS agr, a."ordemPagamentoAgrupadoId" AS pai, g."valorRepasseGuardador" AS valor
           FROM ordem_pagamento_guardador g
           JOIN ordem_pagamento_agrupado a ON a.id = g."ordemPagamentoAgrupadoId"
          WHERE g."userId" = $1
       ),
       alvo AS (SELECT agr AS id FROM meus UNION SELECT pai FROM meus WHERE pai IS NOT NULL)
       SELECT to_char(da."dataVencimento", 'YYYY-MM-DD') AS data,
              d.devido::numeric(18,2)::text AS "valorDevido",
              da."valorLancamento"::numeric(18,2)::text AS "valorPago",
              (da."valorLancamento" - d.devido)::numeric(18,2)::text AS diferenca,
              oph."statusRemessa" AS "statusRemessa"
         FROM alvo
         JOIN ordem_pagamento_agrupado_historico oph ON oph."ordemPagamentoAgrupadoId" = alvo.id
         JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = oph.id
        CROSS JOIN LATERAL (SELECT COALESCE(sum(m.valor), 0) AS devido FROM meus m WHERE m.agr = alvo.id OR m.pai = alvo.id) d
        WHERE da."valorLancamento" < d.devido
        ORDER BY da."dataVencimento" DESC, da.id DESC`,
      params,
    );

    // Cada ordem do guardador com a data em que foi paga (agrupamento da ordem ou do pai, pago/efetivado).
    const ordens: { dia: string; valor: string; pagoEm: string | null }[] = await this.dataSource.query(
      `SELECT to_char(g."dataOrdem", 'YYYY-MM-DD') AS dia, g."valorRepasseGuardador"::numeric(18,2)::text AS valor,
              (SELECT to_char(min(da."dataVencimento"), 'YYYY-MM-DD')
                 FROM ordem_pagamento_agrupado_historico h
                 JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = h.id
                WHERE h."statusRemessa" IN (3, 5)
                  AND h."ordemPagamentoAgrupadoId" IN (g."ordemPagamentoAgrupadoId", a."ordemPagamentoAgrupadoId")) AS "pagoEm"
         FROM ordem_pagamento_guardador g
         JOIN ordem_pagamento_agrupado a ON a.id = g."ordemPagamentoAgrupadoId"
        WHERE g."userId" = $1`,
      params,
    );

    return { totais, lancamentos, datasDuplicidade: PagamentosIndevidosGuardadoresService.datasDeDuplicidade(ordens) };
  }

  /**
   * A mesma ordem (mesmo dia e valor) paga mais de uma vez: a primeira vez é a devida, as seguintes são a duplicidade.
   * Devolve as datas desses pagamentos repetidos, sem repetição e em ordem.
   */
  static datasDeDuplicidade(ordens: { dia: string; valor: string; pagoEm: string | null }[]): string[] {
    const porOrdem = new Map<string, string[]>();
    for (const o of ordens) {
      if (!o.pagoEm) continue;
      const chave = `${o.dia}|${o.valor}`;
      porOrdem.set(chave, [...(porOrdem.get(chave) ?? []), o.pagoEm]);
    }
    const repetidas = new Set<string>();
    for (const datas of porOrdem.values()) {
      [...datas].sort().slice(1).forEach((d) => repetidas.add(d));
    }
    return [...repetidas].sort();
  }

  /** Todas as linhas do filtro (até o limite), para a exportação em Excel. */
  async exportar(filtro: FiltroPagamentosIndevidos): Promise<{ limite: number; itens: LinhaPagamentoIndevido[] }> {
    const params: unknown[] = [];
    const where = this.where(filtro, params);
    const itens = await this.dataSource.query(
      `WITH ${this.cte()}
       SELECT ${this.colunas()} FROM calculado ${where}
       ORDER BY saldo DESC, guardador, id LIMIT ${LIMITE_EXPORTACAO + 1}`,
      params,
    );
    return { limite: LIMITE_EXPORTACAO, itens };
  }
}
