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
  /** Qual ordem foi paga em duplicidade: a ordem (dia e valor), a primeira vez que foi paga e as vezes seguintes (AAAA-MM-DD). */
  duplicidades: DuplicidadeOrdem[];
}

/** Uma ordem do guardador (dia e valor) com as datas em que foi paga (AAAA-MM-DD). */
export interface OrdemComPagamentos {
  dia: string;
  valor: string;
  pagamentos: string[];
}

export interface DuplicidadeOrdem {
  /** Dia da ordem (AAAA-MM-DD). */
  dataOrdem: string;
  valor: string;
  /** Data do pagamento devido (a primeira vez que a ordem foi paga). */
  pagoEm: string;
  /** Datas dos pagamentos repetidos, em ordem. */
  repetidoEm: string[];
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

    // Os quadros são fixos: somam todos os registros, sem busca nem situação (o filtro vale só para a lista e o total dela).
    const [totais] = await this.dataSource.query(
      `WITH ${this.cte()}
       SELECT count(*)::int AS quantidade, count(*) FILTER (WHERE situacao = 'devendo')::int AS devendo,
              COALESCE(sum(indevido), 0)::numeric(18,2)::text AS "valorIndevido",
              COALESCE(sum(debitado), 0)::numeric(18,2)::text AS "valorDebitado",
              COALESCE(sum(saldo), 0)::numeric(18,2)::text AS "saldoDevedor"
         FROM calculado`,
    );
    const [{ total }] = await this.dataSource.query(
      `WITH ${this.cte()} SELECT count(*)::int AS total FROM calculado ${where}`,
      params,
    );
    const itens = await this.dataSource.query(
      `WITH ${this.cte()}
       SELECT ${this.colunas()} FROM calculado ${where}
       ORDER BY guardador, "dataReferencia" DESC NULLS LAST, id DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params,
    );
    return { total, page, pageSize, totais, itens };
  }

  /**
   * Indevido de UM guardador (para a tela do guardador): as linhas dele e os totais. O quadro só aparece quando
   * `totais.saldoDevedor` é maior que zero, mas os lançamentos (pagamentos abatidos) saem enquanto houver indevido, mesmo quitado.
   * Guardador desconhecido ou sem linhas devolve totais zerados e lista vazia.
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
    // Sem pagamento indevido não há abatimento a mostrar: poupa as consultas abaixo. Com o débito quitado os lançamentos continuam
    // saindo, porque a tela marca como "Abatimento por duplicidade" os pagamentos que foram abatidos.
    if (!(Number(totais?.quantidade) > 0)) {
      return { totais, lancamentos: [], datasDuplicidade: [], duplicidades: [] };
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

    // Cada ordem do guardador com TODAS as datas em que foi paga (agrupamento da ordem ou do pai, pago/efetivado).
    const ordens: OrdemComPagamentos[] = await this.dataSource.query(
      `SELECT to_char(g."dataOrdem", 'YYYY-MM-DD') AS dia, g."valorRepasseGuardador"::numeric(18,2)::text AS valor,
              ARRAY(SELECT DISTINCT to_char(da."dataVencimento", 'YYYY-MM-DD')
                      FROM ordem_pagamento_agrupado_historico h
                      JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = h.id
                     WHERE h."statusRemessa" IN (3, 5)
                       -- Status 5 com ocorrência 02 (crédito cancelado) é a ordem que só virou "paga" quando a pendência do pai foi quitada;
                       -- o banco não pagou aquele lançamento, então não conta como pagamento (nem como duplicidade).
                       AND NOT (h."statusRemessa" = 5 AND h."motivoStatusRemessa" = '02')
                       AND h."ordemPagamentoAgrupadoId" IN (g."ordemPagamentoAgrupadoId", a."ordemPagamentoAgrupadoId")) AS pagamentos
         FROM ordem_pagamento_guardador g
         JOIN ordem_pagamento_agrupado a ON a.id = g."ordemPagamentoAgrupadoId"
        WHERE g."userId" = $1`,
      params,
    );

    return {
      totais,
      lancamentos,
      datasDuplicidade: PagamentosIndevidosGuardadoresService.datasDeDuplicidade(ordens),
      duplicidades: PagamentosIndevidosGuardadoresService.duplicidadesDeOrdens(ordens),
    };
  }

  /**
   * Quais ordens foram pagas em duplicidade. Ordens do mesmo dia e valor são a mesma ordem; junta TODAS as datas em que ela foi
   * paga (de qualquer ordem do grupo, sem repetir). A primeira é o pagamento devido; as seguintes são a duplicidade.
   * Uma ordem que entrou em dois pagamentos (ex.: 23/09 e depois de novo no cumulativo de 01/10) também conta.
   */
  static duplicidadesDeOrdens(ordens: OrdemComPagamentos[]): DuplicidadeOrdem[] {
    const porOrdem = new Map<string, { dataOrdem: string; valor: string; datas: Set<string> }>();
    for (const o of ordens) {
      if (!o.pagamentos?.length) continue;
      const chave = `${o.dia}|${o.valor}`;
      const atual = porOrdem.get(chave) ?? { dataOrdem: o.dia, valor: o.valor, datas: new Set<string>() };
      o.pagamentos.forEach((d) => atual.datas.add(d));
      porOrdem.set(chave, atual);
    }
    const resultado: DuplicidadeOrdem[] = [];
    for (const { dataOrdem, valor, datas } of porOrdem.values()) {
      if (datas.size < 2) continue;
      const [pagoEm, ...repetidoEm] = [...datas].sort();
      resultado.push({ dataOrdem, valor, pagoEm, repetidoEm });
    }
    return resultado.sort((x, y) => x.dataOrdem.localeCompare(y.dataOrdem) || x.valor.localeCompare(y.valor));
  }

  /** Datas (sem repetir e em ordem) dos pagamentos em duplicidade, de todas as ordens duplicadas. */
  static datasDeDuplicidade(ordens: OrdemComPagamentos[]): string[] {
    const repetidas = new Set<string>();
    for (const d of PagamentosIndevidosGuardadoresService.duplicidadesDeOrdens(ordens)) d.repetidoEm.forEach((x) => repetidas.add(x));
    return [...repetidas].sort();
  }

  /** Todas as linhas do filtro (até o limite), para a exportação em Excel. */
  async exportar(filtro: FiltroPagamentosIndevidos): Promise<{ limite: number; itens: LinhaPagamentoIndevido[] }> {
    const params: unknown[] = [];
    const where = this.where(filtro, params);
    const itens = await this.dataSource.query(
      `WITH ${this.cte()}
       SELECT ${this.colunas()} FROM calculado ${where}
       ORDER BY guardador, id LIMIT ${LIMITE_EXPORTACAO + 1}`,
      params,
    );
    return { limite: LIMITE_EXPORTACAO, itens };
  }
}
