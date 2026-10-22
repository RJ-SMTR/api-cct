import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TABELAS_AUDITADAS } from 'src/database/migrations/1791400000000-CreateAuditoria';
import {
  CAMPOS_COMPARADOS,
  CampoComparado,
  DadosOrdem,
  fatia,
  hashOrdem,
  normalizarDadosOrdem,
} from './ordem-sync.utils';

export interface Paginacao {
  page: number;
  pageSize: number;
}

export const MAX_PAGE_SIZE = 200;

/** Normaliza page/pageSize vindos da query string. */
export function paginar(page?: unknown, pageSize?: unknown): Paginacao {
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const t = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(Number(pageSize)) || 50));
  return { page: p, pageSize: t };
}

/** Acumula condições SQL parametrizadas. */
class Condicoes {
  readonly params: unknown[] = [];
  private readonly partes: string[] = [];

  adicionar(sql: string, valor: unknown): this {
    if (valor === undefined || valor === null || valor === '') return this;
    this.params.push(valor);
    this.partes.push(sql.replace(/\?/g, `$${this.params.length}`));
    return this;
  }

  get where(): string {
    return this.partes.length ? `WHERE ${this.partes.join(' AND ')}` : '';
  }

  get proximoIndice(): number {
    return this.params.length + 1;
  }
}

const TIPO_COLUNA: Record<CampoComparado, 'numeric' | 'date' | 'text'> = {
  dataOrdem: 'date',
  idConsorcio: 'text',
  idOperadora: 'text',
  operadoraCpfCnpj: 'text',
  idOrdemPagamento: 'text',
  nomeConsorcio: 'text',
  nomeOperadora: 'text',
  valor: 'numeric',
  valorGratuidade: 'numeric',
};

@Injectable()
export class AuditoriaService {
  constructor(private readonly dataSource: DataSource) {}

  private async listar<T = any>(
    from: string,
    colunas: string,
    cond: Condicoes,
    ordem: string,
    { page, pageSize }: Paginacao,
  ): Promise<{ total: number; page: number; pageSize: number; itens: T[] }> {
    const [{ total }] = await this.dataSource.query(`SELECT count(*)::int AS total FROM ${from} ${cond.where}`, cond.params);
    const itens: T[] = await this.dataSource.query(
      `SELECT ${colunas} FROM ${from} ${cond.where} ORDER BY ${ordem} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      cond.params,
    );
    return { total, page, pageSize, itens };
  }

  // ---------- sincronismo de ordens ----------

  execucoes(filtro: { origem?: string; status?: string }, pag: Paginacao) {
    const cond = new Condicoes().adicionar('origem = ?', filtro.origem).adicionar('status = ?', filtro.status);
    return this.listar('sync_execucao', "id, tipo, origem, usuario_id, forcar, to_char(janela_inicio, 'YYYY-MM-DD') AS janela_inicio, to_char(janela_fim, 'YYYY-MM-DD') AS janela_fim, consorcios, iniciada_em, finalizada_em, status, encontradas, novas, identicas, alteradas, contidas, ignoradas, erros, observacao", cond, 'id DESC', pag);
  }

  async execucao(id: number) {
    const [execucao] = await this.dataSource.query(`SELECT * FROM sync_execucao WHERE id = $1`, [id]);
    if (!execucao) throw new HttpException({ error: 'Execução não encontrada.' }, HttpStatus.NOT_FOUND);
    const porAcao = await this.dataSource.query(
      `SELECT acao, count(*)::int AS qtd FROM ordem_pagamento_auditoria WHERE execucao_id = $1 GROUP BY acao ORDER BY acao`,
      [id],
    );
    return { ...execucao, auditoria: porAcao };
  }

  ordens(filtro: { acao?: string; bqId?: number; ordemId?: number; execucaoId?: number; dataInicio?: string; dataFim?: string }, pag: Paginacao) {
    const cond = new Condicoes()
      .adicionar('acao = ?', filtro.acao)
      .adicionar('bq_id = ?', filtro.bqId)
      .adicionar('ordem_pagamento_id = ?', filtro.ordemId)
      .adicionar('execucao_id = ?', filtro.execucaoId)
      .adicionar('criado_em >= ?::date', filtro.dataInicio)
      .adicionar('criado_em < (?::date + 1)', filtro.dataFim);
    return this.listar('ordem_pagamento_auditoria', '*', cond, 'id DESC', pag);
  }

  quarentena(filtro: { status?: string; bqId?: number }, pag: Paginacao) {
    const cond = new Condicoes().adicionar('q.status = ?', filtro.status).adicionar('q.bq_id = ?', filtro.bqId);
    return this.listar(
      `ordem_pagamento_quarentena q LEFT JOIN ordem_pagamento op ON op.id = q.ordem_pagamento_id`,
      `q.*, op."nomeOperadora" AS nome_operadora, op."nomeConsorcio" AS nome_consorcio,
       op."ordemPagamentoAgrupadoId" AS agrupamento_id, op."ordemPagamentoAgrupadoGratuidadeId" AS agrupamento_gratuidade_id`,
      cond,
      `(q.status = 'pendente') DESC, q.id DESC`,
      pag,
    );
  }

  /**
   * Revisão da quarentena. Aprovar aplica na ordem os valores do BigQuery que estavam contidos; rejeitar mantém a
   * ordem como está. Nos dois casos a decisão fica na auditoria append-only, com o usuário e a observação.
   */
  async revisarQuarentena(id: number, decisao: 'aprovar' | 'rejeitar', usuarioId: number, observacao?: string) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const [q] = await runner.query(`SELECT * FROM ordem_pagamento_quarentena WHERE id = $1 FOR UPDATE`, [id]);
      if (!q) throw new HttpException({ error: 'Item da quarentena não encontrado.' }, HttpStatus.NOT_FOUND);
      if (q.status !== 'pendente') {
        throw new HttpException({ error: `Este item já está ${q.status}.` }, HttpStatus.CONFLICT);
      }

      let antes: unknown = null;
      let depois: unknown = null;
      let motivo = observacao?.trim() || (decisao === 'aprovar' ? 'Aprovado na revisão da quarentena.' : 'Rejeitado na revisão da quarentena.');

      if (decisao === 'aprovar') {
        const [ordem] = await runner.query(`SELECT * FROM ordem_pagamento WHERE id = $1 FOR UPDATE`, [q.ordem_pagamento_id]);
        if (!ordem) throw new HttpException({ error: 'A ordem de pagamento não existe mais.' }, HttpStatus.CONFLICT);
        const atuais = normalizarDadosOrdem(ordem);
        const campos = (q.campos_divergentes as string[]).filter((c): c is CampoComparado => (CAMPOS_COMPARADOS as readonly string[]).includes(c));
        const novos = q.dados_bq as DadosOrdem;
        if (campos.length === 0) throw new HttpException({ error: 'Nada a aplicar.' }, HttpStatus.UNPROCESSABLE_ENTITY);

        const sets = campos.map((campo, i) => `"${campo}" = $${i + 2}::${TIPO_COLUNA[campo]}`);
        const valores = campos.map((campo) => novos[campo]);
        const resultante: DadosOrdem = { ...atuais, ...fatia(novos, campos) };
        await runner.query(
          `UPDATE ordem_pagamento SET ${sets.join(', ')}, "bqHash" = $${campos.length + 2} WHERE id = $1`,
          [q.ordem_pagamento_id, ...valores, hashOrdem(resultante)],
        );
        antes = fatia(atuais, campos);
        depois = fatia(novos, campos);
        motivo = `${motivo} (aplicado em ${campos.join(', ')})`;
      }

      await runner.query(
        `UPDATE ordem_pagamento_quarentena
            SET status = $2, observacao_revisao = $3, revisado_por = $4, revisado_em = now()
          WHERE id = $1`,
        [id, decisao === 'aprovar' ? 'aprovada' : 'rejeitada', observacao ?? null, usuarioId],
      );
      await runner.query(
        `INSERT INTO ordem_pagamento_auditoria (execucao_id, bq_id, ordem_pagamento_id, acao, antes, depois, motivo, usuario_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
        [
          q.execucao_id,
          q.bq_id,
          q.ordem_pagamento_id,
          decisao === 'aprovar' ? 'APROVADA' : 'REJEITADA',
          antes == null ? null : JSON.stringify(antes),
          depois == null ? null : JSON.stringify(depois),
          motivo,
          usuarioId,
        ],
      );
      await runner.commitTransaction();
      return { id, status: decisao === 'aprovar' ? 'aprovada' : 'rejeitada' };
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  reconciliacao(filtro: { dataInicio?: string; dataFim?: string; somenteDivergentes?: boolean }, pag: Paginacao) {
    const cond = new Condicoes()
      .adicionar('data >= ?::date', filtro.dataInicio)
      .adicionar('data <= ?::date', filtro.dataFim);
    const base = filtro.somenteDivergentes ? '(dif_qtd <> 0 OR dif_valor <> 0)' : null;
    const where = base ? (cond.where ? `${cond.where} AND ${base}` : `WHERE ${base}`) : cond.where;
    return this.listarComWhere('ordem_pagamento_reconciliacao_diaria', "to_char(data, 'YYYY-MM-DD') AS data, bq_qtd, bq_valor, bd_qtd, bd_valor, dif_qtd, dif_valor, execucao_id, calculado_em", where, cond.params, 'data DESC', pag);
  }

  private async listarComWhere<T = any>(from: string, colunas: string, where: string, params: unknown[], ordem: string, { page, pageSize }: Paginacao) {
    const [{ total }] = await this.dataSource.query(`SELECT count(*)::int AS total FROM ${from} ${where}`, params);
    const itens: T[] = await this.dataSource.query(
      `SELECT ${colunas} FROM ${from} ${where} ORDER BY ${ordem} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params,
    );
    return { total, page, pageSize, itens };
  }

  /**
   * "Guarda" 1 ordem = 1 pagamento: ordens ligadas a mais de um pagamento efetivado (status 3 ou 5), olhando o
   * agrupamento da própria ordem e o agrupamento pai (pendências). Só ordens capturadas a partir de `desde`.
   */
  async guarda(desde: string, pag: Paginacao) {
    const base = `
      FROM ordem_pagamento op
      JOIN ordem_pagamento_agrupado a ON a.id = op."ordemPagamentoAgrupadoId"
      JOIN ordem_pagamento_agrupado_historico h ON h."ordemPagamentoAgrupadoId" IN (a.id, a."ordemPagamentoAgrupadoId")
      JOIN detalhe_a da ON da."ordemPagamentoAgrupadoHistoricoId" = h.id
     WHERE op."dataCaptura" >= $1::date AND h."statusRemessa" IN (3, 5)
     GROUP BY op.id
    HAVING count(DISTINCT da.id) > 1`;
    const [{ total }] = await this.dataSource.query(`SELECT count(*)::int AS total FROM (SELECT op.id ${base}) x`, [desde]);
    const itens = await this.dataSource.query(
      `SELECT op.id AS ordem_id, op."bqId" AS bq_id, op."nomeConsorcio" AS nome_consorcio, op."nomeOperadora" AS nome_operadora,
              op.valor, to_char(op."dataCaptura"::date, 'YYYY-MM-DD') AS data_captura, count(DISTINCT da.id)::int AS pagamentos,
              array_agg(DISTINCT da.id ORDER BY da.id) AS detalhe_a_ids,
              round(sum(DISTINCT da."valorLancamento")::numeric, 2) AS soma_lancamentos
       ${base} ORDER BY op."dataCaptura" DESC, op.id DESC LIMIT ${pag.pageSize} OFFSET ${(pag.page - 1) * pag.pageSize}`,
      [desde],
    );
    return { total, page: pag.page, pageSize: pag.pageSize, desde, itens };
  }

  // ---------- auditoria do sistema ----------

  sistema(
    filtro: { tabela?: string; operacao?: string; registroId?: string; usuarioId?: number; dataInicio?: string; dataFim?: string; texto?: string },
    pag: Paginacao,
  ) {
    const cond = new Condicoes()
      .adicionar('tabela = ?', filtro.tabela)
      .adicionar('operacao = ?', filtro.operacao)
      .adicionar('registro_id = ?', filtro.registroId)
      .adicionar('usuario_app_id = ?', filtro.usuarioId)
      .adicionar('criado_em >= ?::date', filtro.dataInicio)
      .adicionar('criado_em < (?::date + 1)', filtro.dataFim)
      .adicionar('(antes::text ILIKE ? OR depois::text ILIKE ?)', filtro.texto ? `%${filtro.texto}%` : undefined);
    return this.listar('auditoria_sistema', '*', cond, 'id DESC', pag);
  }

  async tabelasAuditadas() {
    const contagens: { tabela: string; qtd: string }[] = await this.dataSource.query(
      `SELECT tabela, count(*) AS qtd FROM auditoria_sistema WHERE criado_em >= now() - interval '24 hours' GROUP BY tabela`,
    );
    const porTabela = new Map(contagens.map((c) => [c.tabela, Number(c.qtd)]));
    return TABELAS_AUDITADAS.map((tabela) => ({ tabela, ultimas24h: porTabela.get(tabela) ?? 0 }));
  }

  requisicoes(filtro: { usuarioId?: number; metodo?: string; rota?: string; dataInicio?: string; dataFim?: string }, pag: Paginacao) {
    const cond = new Condicoes()
      .adicionar('usuario_id = ?', filtro.usuarioId)
      .adicionar('metodo = ?', filtro.metodo?.toUpperCase())
      .adicionar('rota ILIKE ?', filtro.rota ? `%${filtro.rota}%` : undefined)
      .adicionar('criado_em >= ?::date', filtro.dataInicio)
      .adicionar('criado_em < (?::date + 1)', filtro.dataFim);
    return this.listar('auditoria_requisicao', '*', cond, 'id DESC', pag);
  }
}
