export type ContaExtrato = 'bilhetagem' | 'cett' | 'rotativo' | 'outras';
export type TipoLancamento = 'C' | 'D';

export const CONTAS_EXTRATO: ContaExtrato[] = ['bilhetagem', 'cett', 'rotativo', 'outras'];

export const NOME_CONTA_EXTRATO: Record<ContaExtrato, string> = {
  bilhetagem: 'Conta Bilhetagem',
  cett: 'Conta CETT',
  rotativo: 'Conta Rotativo',
  outras: 'Outras contas',
};

/**
 * Números de conta (sem zeros à esquerda) de cada conta do extrato. Cada conta teve mais de um número ao longo do
 * tempo (a migração de 2026 trocou os números), então o extrato é consolidado por conta de negócio.
 */
export const NUMEROS_POR_CONTA: Record<Exclude<ContaExtrato, 'outras'>, string[]> = {
  bilhetagem: ['575279194', '6000071084', '600071084'],
  cett: ['575278026', '6000071083', '600071083'],
  rotativo: ['566697069'],
};

/** Expressão SQL que classifica o lançamento (alias `e` = extrato_detalhe_e) na conta de negócio. */
export const sqlContaExtrato = (alias = 'e') => {
  const quando = (Object.keys(NUMEROS_POR_CONTA) as Exclude<ContaExtrato, 'outras'>[])
    .map((conta) => `WHEN ltrim(${alias}.conta, '0') IN (${NUMEROS_POR_CONTA[conta].map((n) => `'${n}'`).join(', ')}) THEN '${conta}'`)
    .join(' ');
  return `CASE ${quando} ELSE 'outras' END`;
};

export interface Totais {
  qtd: number;
  valor: number;
}

export interface LinhaResumoExtrato {
  conta: ContaExtrato;
  dia: string; // YYYY-MM-DD
  tipo: TipoLancamento;
  descricao: string;
  qtd: number | string;
  valor: number | string;
}

export interface DiaResumo {
  data: string;
  entradas: number;
  saidas: number;
}

export interface HistoricoResumo {
  tipo: TipoLancamento;
  descricao: string;
  qtd: number;
  valor: number;
}

export interface ContaResumoExtrato {
  conta: ContaExtrato;
  nome: string;
  entradas: Totais;
  saidas: Totais;
  /** Entradas - saídas no período (não é o saldo bancário). */
  resultado: number;
  porDia: DiaResumo[];
  porHistorico: HistoricoResumo[];
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

/** Agrega as linhas (conta x dia x tipo x histórico) no formato do dashboard. Todas as contas aparecem, mesmo zeradas. */
export function montarResumoExtrato(linhas: LinhaResumoExtrato[]): ContaResumoExtrato[] {
  return CONTAS_EXTRATO.map((conta) => {
    const doConta = linhas.filter((l) => l.conta === conta);
    const entradas: Totais = { qtd: 0, valor: 0 };
    const saidas: Totais = { qtd: 0, valor: 0 };
    const dias = new Map<string, DiaResumo>();
    const historicos = new Map<string, HistoricoResumo>();
    for (const l of doConta) {
      const qtd = Number(l.qtd) || 0;
      const valor = Number(l.valor) || 0;
      const total = l.tipo === 'C' ? entradas : saidas;
      total.qtd += qtd;
      total.valor += valor;
      const dia = dias.get(l.dia) ?? { data: l.dia, entradas: 0, saidas: 0 };
      if (l.tipo === 'C') dia.entradas += valor;
      else dia.saidas += valor;
      dias.set(l.dia, dia);
      const chave = `${l.tipo}|${l.descricao}`;
      const h = historicos.get(chave) ?? { tipo: l.tipo, descricao: l.descricao, qtd: 0, valor: 0 };
      h.qtd += qtd;
      h.valor += valor;
      historicos.set(chave, h);
    }
    entradas.valor = arredondar(entradas.valor);
    saidas.valor = arredondar(saidas.valor);
    return {
      conta,
      nome: NOME_CONTA_EXTRATO[conta],
      entradas,
      saidas,
      resultado: arredondar(entradas.valor - saidas.valor),
      porDia: [...dias.values()].sort((a, b) => a.data.localeCompare(b.data)).map((d) => ({ ...d, entradas: arredondar(d.entradas), saidas: arredondar(d.saidas) })),
      porHistorico: [...historicos.values()].sort((a, b) => b.valor - a.valor).map((h) => ({ ...h, valor: arredondar(h.valor) })),
    };
  });
}
