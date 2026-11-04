import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CONTAS_EXTRATO, ContaExtrato, ContaResumoExtrato, LinhaResumoExtrato, montarResumoExtrato, sqlContaExtrato } from './extrato-dashboard.utils';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;
const LIMITE_EXPORTACAO = 10000;

export interface FiltroPeriodoExtrato {
  dataInicio: string;
  dataFim: string;
}

export interface FiltroDetalheExtrato extends FiltroPeriodoExtrato {
  conta: ContaExtrato;
  /** 'C', 'D' ou 'C,D' (os dois equivalem a não filtrar). */
  tipo?: string;
  /** Descrição do histórico bancário (ex.: PIX RECEBIDO), como devolvida no resumo. */
  descricao?: string;
  /** Um único dia (YYYY-MM-DD), para detalhar um ponto do gráfico diário. */
  dia?: string;
  /** Parte da descrição, do documento ou do CNPJ/CPF do lançamento. */
  busca?: string;
  /** Parte do nome do favorecido, buscado em `user` pelo CPF/CNPJ do lançamento. */
  nome?: string;
  page?: number;
  pageSize?: number;
}

export interface LinhaDetalheExtrato {
  id: number;
  conta: ContaExtrato;
  data: string;
  tipo: 'C' | 'D';
  valor: string;
  descricao: string;
  codigoHistorico: string;
  categoria: string;
  numeroDocumento: string;
  nsr: number;
  numeroInscricao: string;
  nomeFavorecido: string | null;
  agencia: string;
  numeroConta: string;
}

/**
 * Dashboard do extrato bancário (CNAB de extrato): entradas, saídas e histórico de cada conta, e o detalhamento
 * dos lançamentos. Lê `extrato_detalhe_e`; a conta de negócio vem do número da conta do lançamento.
 */
@Injectable()
export class ExtratoDashboardService {
  constructor(private readonly dataSource: DataSource) {}

  private validarPeriodo({ dataInicio, dataFim }: FiltroPeriodoExtrato) {
    if (!DATA_ISO.test(dataInicio ?? '') || !DATA_ISO.test(dataFim ?? '') || dataFim < dataInicio) {
      throw new HttpException({ error: 'Informe um período válido (dataInicio <= dataFim, YYYY-MM-DD).' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const dias = (Date.parse(dataFim) - Date.parse(dataInicio)) / 86400000 + 1;
    if (dias > MAX_DIAS) {
      throw new HttpException({ error: `Período máximo de ${MAX_DIAS} dias.` }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  async resumo(periodo: FiltroPeriodoExtrato): Promise<{ dataInicio: string; dataFim: string; contas: ContaResumoExtrato[] }> {
    this.validarPeriodo(periodo);
    const linhas: LinhaResumoExtrato[] = await this.dataSource.query(
      `SELECT ${sqlContaExtrato()} AS conta, to_char(e."dataLancamento", 'YYYY-MM-DD') AS dia, e."tipoLancamento" AS tipo,
              e."descricaoHistoricoBanco" AS descricao, count(*)::int AS qtd, COALESCE(sum(e."valorLancamento"), 0)::numeric(18,2)::text AS valor
         FROM extrato_detalhe_e e
        WHERE e."dataLancamento" >= $1::date AND e."dataLancamento" < ($2::date + 1) AND e."tipoLancamento" IN ('C', 'D')
        GROUP BY 1, 2, 3, 4`,
      [periodo.dataInicio, periodo.dataFim],
    );
    return { dataInicio: periodo.dataInicio, dataFim: periodo.dataFim, contas: montarResumoExtrato(linhas) };
  }

  private condicoes(filtro: FiltroDetalheExtrato) {
    if (!CONTAS_EXTRATO.includes(filtro.conta)) {
      throw new HttpException({ error: 'Conta inválida.' }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    this.validarPeriodo(filtro);
    const params: unknown[] = [filtro.dataInicio, filtro.dataFim, filtro.conta];
    const condicoes = [
      `e."dataLancamento" >= $1::date AND e."dataLancamento" < ($2::date + 1)`,
      `${sqlContaExtrato()} = $3`,
      `e."tipoLancamento" IN ('C', 'D')`,
    ];
    const adicionar = (sql: string, valor: unknown) => {
      if (valor === undefined || valor === null || valor === '') return;
      params.push(valor);
      condicoes.push(sql.replace(/\?/g, `$${params.length}`));
    };
    const tipos = [...new Set(String(filtro.tipo ?? '').split(',').map((t) => t.trim()))].filter((t) => t === 'C' || t === 'D');
    if (tipos.length === 1) adicionar('e."tipoLancamento" = ?', tipos[0]);
    const nome = filtro.nome?.trim();
    if (nome) {
      adicionar(
        `ltrim(e."numeroInscricao", '0') <> '' AND ltrim(e."numeroInscricao", '0') IN (
           SELECT ltrim(regexp_replace(u."cpfCnpj", '\\D', '', 'g'), '0') FROM "user" u
            WHERE u."deletedAt" IS NULL AND u."cpfCnpj" IS NOT NULL AND u."fullName" ILIKE ?)`,
        `%${nome}%`,
      );
    }
    adicionar('e."descricaoHistoricoBanco" = ?', filtro.descricao);
    if (filtro.dia && DATA_ISO.test(filtro.dia)) adicionar('e."dataLancamento"::date = ?::date', filtro.dia);
    const busca = filtro.busca?.trim();
    if (busca) {
      adicionar(`(e."descricaoHistoricoBanco" ILIKE ? OR e."numeroDocumento" ILIKE ? OR e."numeroInscricao" ILIKE ?)`, `%${busca}%`);
    }
    return { where: `WHERE ${condicoes.join(' AND ')}`, params };
  }

  /** Nome do favorecido: usuário cujo CPF/CNPJ (só dígitos, sem zeros à esquerda) é o do lançamento. */
  private joinFavorecido() {
    return `LEFT JOIN (
        SELECT ltrim(regexp_replace(u."cpfCnpj", '\\D', '', 'g'), '0') AS doc, min(u."fullName") AS nome
          FROM "user" u WHERE u."deletedAt" IS NULL AND u."cpfCnpj" IS NOT NULL AND u."fullName" IS NOT NULL
         GROUP BY 1) f ON f.doc <> '' AND f.doc = ltrim(e."numeroInscricao", '0')`;
  }

  private colunas() {
    return `e.id, ${sqlContaExtrato()} AS conta, to_char(e."dataLancamento", 'YYYY-MM-DD') AS data, e."tipoLancamento" AS tipo,
            e."valorLancamento"::numeric(18,2)::text AS valor, e."descricaoHistoricoBanco" AS descricao,
            e."codigoHistoricoBanco" AS "codigoHistorico", e."categoriaLancamento" AS categoria, e."numeroDocumento",
            e.nsr, e."numeroInscricao", f.nome AS "nomeFavorecido", e.agencia, e.conta || '-' || e."dvConta" AS "numeroConta"`;
  }

  async detalhe(filtro: FiltroDetalheExtrato) {
    const page = Math.max(1, Math.floor(Number(filtro.page)) || 1);
    const pageSize = Math.min(2000, Math.max(1, Math.floor(Number(filtro.pageSize)) || 100));
    const { where, params } = this.condicoes(filtro);
    const [totais] = await this.dataSource.query(
      `SELECT count(*)::int AS total,
              COALESCE(sum(e."valorLancamento") FILTER (WHERE e."tipoLancamento" = 'C'), 0)::numeric(18,2)::text AS entradas,
              COALESCE(sum(e."valorLancamento") FILTER (WHERE e."tipoLancamento" = 'D'), 0)::numeric(18,2)::text AS saidas
         FROM extrato_detalhe_e e ${where}`,
      params,
    );
    const itens: LinhaDetalheExtrato[] = await this.dataSource.query(
      `SELECT ${this.colunas()} FROM extrato_detalhe_e e ${this.joinFavorecido()} ${where}
        ORDER BY e."dataLancamento" DESC, e.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      params,
    );
    return { total: totais.total, entradas: totais.entradas, saidas: totais.saidas, page, pageSize, itens };
  }

  async exportar(filtro: FiltroDetalheExtrato): Promise<{ itens: LinhaDetalheExtrato[] }> {
    const { where, params } = this.condicoes(filtro);
    const itens: LinhaDetalheExtrato[] = await this.dataSource.query(
      `SELECT ${this.colunas()} FROM extrato_detalhe_e e ${this.joinFavorecido()} ${where}
        ORDER BY e."dataLancamento", e.id LIMIT ${LIMITE_EXPORTACAO + 1}`,
      params,
    );
    if (itens.length > LIMITE_EXPORTACAO) {
      throw new HttpException({ error: `A exportação passa de ${LIMITE_EXPORTACAO} lançamentos. Refine o filtro.` }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
    return { itens };
  }
}
