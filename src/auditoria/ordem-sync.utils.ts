import { createHash } from 'crypto';

/** Campos da ordem que entram na comparação com o BigQuery (chave bqId + hash destes campos). */
export const CAMPOS_COMPARADOS = [
  'dataOrdem',
  'idConsorcio',
  'idOperadora',
  'operadoraCpfCnpj',
  'idOrdemPagamento',
  'nomeConsorcio',
  'nomeOperadora',
  'valor',
  'valorGratuidade',
] as const;

export type CampoComparado = (typeof CAMPOS_COMPARADOS)[number];

/** Campos que só pertencem ao agrupamento de gratuidade (CETT): têm vínculo próprio. */
export const CAMPOS_GRATUIDADE: CampoComparado[] = ['valorGratuidade'];

export type DadosOrdem = { bqId: number | null } & Record<CampoComparado, string | null>;

const texto = (valor: unknown): string | null => {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  return t === '' ? null : t;
};

const dinheiro = (valor: unknown): string | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n.toFixed(5) : null;
};

const dia = (valor: unknown): string | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  const m = String(valor).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** Normaliza uma ordem (entidade do banco ou convertida do BigQuery) para comparar sem falso positivo de formato. */
export function normalizarDadosOrdem(ordem: Record<string, any>): DadosOrdem {
  return {
    bqId: ordem.bqId === null || ordem.bqId === undefined ? null : Number(ordem.bqId),
    dataOrdem: dia(ordem.dataOrdem),
    idConsorcio: texto(ordem.idConsorcio),
    idOperadora: texto(ordem.idOperadora),
    operadoraCpfCnpj: texto(ordem.operadoraCpfCnpj),
    idOrdemPagamento: texto(ordem.idOrdemPagamento),
    nomeConsorcio: texto(ordem.nomeConsorcio),
    nomeOperadora: texto(ordem.nomeOperadora),
    valor: dinheiro(ordem.valor),
    valorGratuidade: dinheiro(ordem.valorGratuidade),
  };
}

/** Hash estável (sha256) dos campos comparados. */
export function hashOrdem(dados: DadosOrdem): string {
  const base = [dados.bqId, ...CAMPOS_COMPARADOS.map((c) => dados[c])];
  return createHash('sha256').update(JSON.stringify(base)).digest('hex');
}

/** Campos cujo valor difere entre o que está no banco e o que veio do BigQuery. */
export function camposDivergentes(atuais: DadosOrdem, novos: DadosOrdem): CampoComparado[] {
  return CAMPOS_COMPARADOS.filter((campo) => atuais[campo] !== novos[campo]);
}

export type ResultadoComparacao = 'nova' | 'identica' | 'mudou';

/** Fatia de uma ordem só com os campos pedidos (para gravar o "antes/depois" da auditoria). */
export function fatia(dados: DadosOrdem, campos: readonly CampoComparado[]): Record<string, string | null> {
  return Object.fromEntries(campos.map((campo) => [campo, dados[campo]]));
}
