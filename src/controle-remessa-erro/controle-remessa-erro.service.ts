import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export type OrigemControle = 'automatico' | 'manual';

export interface LinhaControleRemessaErro {
  /** "auto-<headerArquivoId>" ou "man-<id>". */
  id: string;
  origem: OrigemControle;
  dataGeracao: string;
  dataPagamento: string | null;
  nomeRemessa: string | null;
  favorecido: string | null;
  valorPagar: number | null;
  valorPagoJuizo: number | null;
  valorTotalPago: number | null;
  status: string | null;
  ocorrencia: string | null;
}

export interface FiltroControleRemessaErro {
  dataInicio?: string;
  dataFim?: string;
  busca?: string;
  origem?: OrigemControle;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface LancamentoManualInput {
  dataGeracao?: string;
  dataPagamento?: string | null;
  nomeRemessa?: string | null;
  favorecido?: string | null;
  valorPagar?: number | string | null;
  valorPagoJuizo?: number | string | null;
  valorTotalPago?: number | string | null;
  status?: string | null;
  ocorrencia?: string | null;
}

const DIAS_PADRAO = 90;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function dataIso(valor: unknown): string | undefined {
  return typeof valor === 'string' && DATA_ISO.test(valor) && !Number.isNaN(Date.parse(valor)) ? valor : undefined;
}

function numeroOuNulo(valor: unknown, campo: string): number | null {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }
  const n = Number(valor);
  if (!Number.isFinite(n) || Math.abs(n) >= 1e15) {
    throw new BadRequestException({ error: `Valor inválido em ${campo}.` });
  }
  return Math.round(n * 100) / 100;
}

const textoOuNulo = (valor: unknown, max: number): string | null => {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  return texto ? texto.slice(0, max) : null;
};

/** Status da remessa a partir das contagens dos pagamentos (só chamado para remessas com algum não efetivado). */
export function statusDaRemessa(total: number, pagos: number, naoEfetivados: number): string {
  if (naoEfetivados >= total) return 'Não Pago';
  if (pagos > 0) return 'Pago parcial';
  return 'Aguardando Pagamento';
}

export function ocorrenciaDaRemessa(total: number, naoEfetivados: number, motivos: string | null): string {
  const base = `${naoEfetivados} de ${total} pagamento(s) não efetivado(s).`;
  return motivos ? `${base} Motivo(s) do banco: ${motivos}.` : `${base} Sem motivo informado pelo banco.`;
}

@Injectable()
export class ControleRemessaErroService {
  constructor(private readonly dataSource: DataSource) {}

  private periodo(filtro: FiltroControleRemessaErro) {
    const fim = dataIso(filtro.dataFim) ?? new Date().toISOString().slice(0, 10);
    const inicio = dataIso(filtro.dataInicio) ?? new Date(Date.parse(fim) - DIAS_PADRAO * 86400000).toISOString().slice(0, 10);
    return { inicio, fim };
  }

  /** Remessas do período que tiveram algum pagamento não efetivado (dados automáticos, somente leitura). */
  private async automaticos(inicio: string, fim: string): Promise<LinhaControleRemessaErro[]> {
    const linhas = await this.dataSource.query(
      `SELECT ha.id, ha."remessaName" AS nome, to_char(ha."dataGeracao"::date, 'YYYY-MM-DD') AS "dataGeracao",
              to_char(min(da."dataVencimento")::date, 'YYYY-MM-DD') AS "dataPagamento",
              string_agg(DISTINCT p."nomeEmpresa", ', ') AS favorecido,
              count(*)::int AS total,
              count(*) FILTER (WHERE oph."statusRemessa" IN (3, 5))::int AS pagos,
              count(*) FILTER (WHERE oph."statusRemessa" = 4)::int AS "naoEfetivados",
              sum(da."valorLancamento")::numeric(18,2) AS "valorPagar",
              COALESCE(sum(da."valorLancamento") FILTER (WHERE oph."statusRemessa" IN (3, 5)), 0)::numeric(18,2) AS "valorPago",
              string_agg(DISTINCT NULLIF(trim(oph."motivoStatusRemessa"::text), ''), ', ') FILTER (WHERE oph."statusRemessa" = 4) AS motivos
         FROM header_arquivo ha
         JOIN header_lote hl ON hl."headerArquivoId" = ha.id
         JOIN detalhe_a da ON da."headerLoteId" = hl.id
         LEFT JOIN pagador p ON p.id = hl."pagadorId"
         LEFT JOIN ordem_pagamento_agrupado_historico oph ON oph.id = da."ordemPagamentoAgrupadoHistoricoId"
        WHERE ha."dataGeracao"::date BETWEEN $1 AND $2
        GROUP BY ha.id
       HAVING count(*) FILTER (WHERE oph."statusRemessa" = 4) > 0
        ORDER BY ha."dataGeracao" DESC`,
      [inicio, fim],
    );
    return linhas.map((l: any) => ({
      id: `auto-${l.id}`,
      origem: 'automatico' as const,
      dataGeracao: l.dataGeracao,
      dataPagamento: l.dataPagamento,
      nomeRemessa: l.nome,
      favorecido: l.favorecido,
      valorPagar: Number(l.valorPagar),
      valorPagoJuizo: null,
      valorTotalPago: Number(l.valorPago),
      status: statusDaRemessa(l.total, l.pagos, l.naoEfetivados),
      ocorrencia: ocorrenciaDaRemessa(l.total, l.naoEfetivados, l.motivos),
    }));
  }

  private async manuais(inicio: string, fim: string): Promise<LinhaControleRemessaErro[]> {
    const linhas = await this.dataSource.query(
      `SELECT id, to_char(data_geracao_remessa, 'YYYY-MM-DD') AS "dataGeracao", to_char(data_pagamento, 'YYYY-MM-DD') AS "dataPagamento",
              nome_remessa AS "nomeRemessa", favorecido, valor_pagar AS "valorPagar", valor_pago_juizo AS "valorPagoJuizo",
              valor_total_pago AS "valorTotalPago", status, ocorrencia
         FROM controle_remessa_erro
        WHERE data_geracao_remessa BETWEEN $1 AND $2
        ORDER BY data_geracao_remessa DESC, id DESC`,
      [inicio, fim],
    );
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    return linhas.map((l: any) => ({
      ...l,
      id: `man-${l.id}`,
      origem: 'manual' as const,
      valorPagar: num(l.valorPagar),
      valorPagoJuizo: num(l.valorPagoJuizo),
      valorTotalPago: num(l.valorTotalPago),
    }));
  }

  async listar(filtro: FiltroControleRemessaErro) {
    const { inicio, fim } = this.periodo(filtro);
    const page = Math.max(1, Math.floor(Number(filtro.page)) || 1);
    const pageSize = Math.min(200, Math.max(1, Math.floor(Number(filtro.pageSize)) || 50));
    const busca = filtro.busca?.trim().toLowerCase();

    const [auto, manual] = await Promise.all([
      filtro.origem === 'manual' ? Promise.resolve([]) : this.automaticos(inicio, fim),
      filtro.origem === 'automatico' ? Promise.resolve([]) : this.manuais(inicio, fim),
    ]);
    const itens = [...auto, ...manual]
      .filter((l) => !filtro.status || l.status === filtro.status)
      .filter((l) => !busca || [l.nomeRemessa, l.favorecido, l.ocorrencia].some((t) => t?.toLowerCase().includes(busca)))
      .sort((a, b) => b.dataGeracao.localeCompare(a.dataGeracao) || b.id.localeCompare(a.id));

    const soma = (campo: 'valorPagar' | 'valorPagoJuizo' | 'valorTotalPago') =>
      Math.round(itens.reduce((acc, l) => acc + (l[campo] ?? 0), 0) * 100) / 100;
    return {
      dataInicio: inicio,
      dataFim: fim,
      total: itens.length,
      page,
      pageSize,
      totais: {
        quantidade: itens.length,
        automaticos: itens.filter((l) => l.origem === 'automatico').length,
        manuais: itens.filter((l) => l.origem === 'manual').length,
        valorPagar: soma('valorPagar'),
        valorPagoJuizo: soma('valorPagoJuizo'),
        valorTotalPago: soma('valorTotalPago'),
      },
      itens: itens.slice((page - 1) * pageSize, page * pageSize),
    };
  }

  private normalizar(input: LancamentoManualInput) {
    const dataGeracao = dataIso(input.dataGeracao);
    if (!dataGeracao) {
      throw new BadRequestException({ error: 'Informe a data de geração da remessa (AAAA-MM-DD).' });
    }
    if (input.dataPagamento && !dataIso(input.dataPagamento)) {
      throw new BadRequestException({ error: 'Data de pagamento inválida (AAAA-MM-DD).' });
    }
    return [
      dataGeracao,
      dataIso(input.dataPagamento) ?? null,
      textoOuNulo(input.nomeRemessa, 300),
      textoOuNulo(input.favorecido, 300),
      numeroOuNulo(input.valorPagar, 'Valor p/ pgto'),
      numeroOuNulo(input.valorPagoJuizo, 'Valor pago em juízo'),
      numeroOuNulo(input.valorTotalPago, 'Valor total pago'),
      textoOuNulo(input.status, 40),
      textoOuNulo(input.ocorrencia, 5000),
    ];
  }

  async criar(input: LancamentoManualInput, usuarioId: number) {
    const [linha] = await this.dataSource.query(
      `INSERT INTO controle_remessa_erro (data_geracao_remessa, data_pagamento, nome_remessa, favorecido, valor_pagar, valor_pago_juizo,
                                          valor_total_pago, status, ocorrencia, criado_por, atualizado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING id`,
      [...this.normalizar(input), usuarioId],
    );
    return { id: `man-${linha.id}` };
  }

  async atualizar(id: number, input: LancamentoManualInput, usuarioId: number) {
    // UPDATE ... RETURNING no driver do Postgres devolve [linhas, quantidade]
    const [, quantidade] = await this.dataSource.query(
      `UPDATE controle_remessa_erro
          SET data_geracao_remessa = $1, data_pagamento = $2, nome_remessa = $3, favorecido = $4, valor_pagar = $5,
              valor_pago_juizo = $6, valor_total_pago = $7, status = $8, ocorrencia = $9, atualizado_por = $10, updated_at = now()
        WHERE id = $11 RETURNING id`,
      [...this.normalizar(input), usuarioId, id],
    );
    if (!quantidade) {
      throw new NotFoundException({ error: 'Lançamento não encontrado.' });
    }
    return { id: `man-${id}` };
  }

  async excluir(id: number) {
    const [, quantidade] = await this.dataSource.query(`DELETE FROM controle_remessa_erro WHERE id = $1 RETURNING id`, [id]);
    if (!quantidade) {
      throw new NotFoundException({ error: 'Lançamento não encontrado.' });
    }
  }
}
