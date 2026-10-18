import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';

export type ContaDashboard = 'bilhetagem' | 'rotativo' | 'cett';
export type SituacaoDashboard = 'pago' | 'naoPago' | 'emAberto';

/** ids de `pagador` (CONTA BILHETAGEM, CETT, CONTA ROTATIVO). */
export const PAGADOR_ID_POR_CONTA: Record<ContaDashboard, number> = {
  bilhetagem: 1,
  cett: 2,
  rotativo: 3,
};

export const NOME_CONTA: Record<ContaDashboard, string> = {
  bilhetagem: 'Conta Bilhetagem',
  rotativo: 'Conta Rotativo',
  cett: 'Conta CETT',
};

export const CONSORCIOS_BILHETAGEM = ['GTU', 'Intersul', 'Internorte', 'MobiRio', 'Santa Cruz', 'Transcarioca', 'TUSE', 'VLT'];
export const MODAIS_BILHETAGEM = ['STPC', 'STPL', 'TEC'];
export const GRUPO_PAGAMENTO_UNICO = 'Pagamento único';
export const GRUPO_GUARDADOR = 'Guardador';
export const GRUPO_OUTROS = 'Outros';

/** Grupos esperados por conta: aparecem no gráfico mesmo sem pagamento no período. */
export const GRUPOS_POR_CONTA: Record<ContaDashboard, { nome: string; tipo: 'consorcio' | 'modal' | 'guardador' | 'unico' }[]> = {
  bilhetagem: [
    ...CONSORCIOS_BILHETAGEM.map((nome) => ({ nome, tipo: 'consorcio' as const })),
    ...MODAIS_BILHETAGEM.map((nome) => ({ nome, tipo: 'modal' as const })),
  ],
  rotativo: [{ nome: GRUPO_GUARDADOR, tipo: 'guardador' }],
  cett: [...MODAIS_BILHETAGEM.map((nome) => ({ nome, tipo: 'modal' as const })), { nome: GRUPO_PAGAMENTO_UNICO, tipo: 'unico' as const }],
};

export const SITUACOES: SituacaoDashboard[] = ['pago', 'naoPago', 'emAberto'];

/** Ordem de exibição no dashboard. */
export const CONTAS: ContaDashboard[] = ['bilhetagem', 'rotativo', 'cett'];

/**
 * Normalização do nome do consórcio/modal direto no SQL. `MOBI-Rio BUM` é tratado como MobiRio.
 * Qualquer outro valor não vazio é mantido como veio; vazio vira "Outros".
 */
export const sqlNormalizarGrupo = (expr: string) => `CASE UPPER(TRIM(${expr}))
    WHEN 'GTU' THEN 'GTU'
    WHEN 'INTERSUL' THEN 'Intersul'
    WHEN 'INTERNORTE' THEN 'Internorte'
    WHEN 'MOBIRIO' THEN 'MobiRio'
    WHEN 'MOBI-RIO BUM' THEN 'MobiRio'
    WHEN 'SANTA CRUZ' THEN 'Santa Cruz'
    WHEN 'TRANSCARIOCA' THEN 'Transcarioca'
    WHEN 'TUSE' THEN 'TUSE'
    WHEN 'VLT' THEN 'VLT'
    WHEN 'STPC' THEN 'STPC'
    WHEN 'STPL' THEN 'STPL'
    WHEN 'TEC' THEN 'TEC'
    ELSE COALESCE(NULLIF(TRIM(${expr}), ''), '${GRUPO_OUTROS}')
  END`;

const DESCRICOES_CUSTOMIZADAS: Record<string, string> = {
  ANHO: 'Conta digital',
  SEM_MOTIVO: 'Motivo não informado pelo banco',
  EFETIVADO: 'Efetivado',
  PENDENCIA_PAGA: 'Pendência paga',
  CRIADO: 'Criado (a pagar)',
  ENVIADO: 'Enviado ao banco (aguardando retorno)',
  AGUARDANDO_PAGAMENTO: 'Aguardando pagamento',
};

/** Código do motivo -> texto. Para "não pago" o código é a ocorrência CNAB devolvida pelo banco. */
export function descreverMotivo(codigo: string | null | undefined): string {
  if (!codigo) return DESCRICOES_CUSTOMIZADAS.SEM_MOTIVO;
  const cod = String(codigo).trim();
  return DESCRICOES_CUSTOMIZADAS[cod] ?? OcorrenciaEnum[cod as keyof typeof OcorrenciaEnum] ?? `Código ${cod}`;
}

export interface LinhaResumo {
  conta: ContaDashboard;
  grupo: string;
  situacao: SituacaoDashboard;
  motivo: string | null;
  qtd: number | string;
  valor: number | string | null;
}

export interface Totais {
  qtd: number;
  valor: number;
}

export interface MotivoResumo extends Totais {
  codigo: string;
  descricao: string;
  situacao: SituacaoDashboard;
}

export interface GrupoResumo {
  grupo: string;
  tipo: string;
  pago: Totais;
  naoPago: Totais;
  emAberto: Totais;
  motivos: MotivoResumo[];
}

export interface ContaResumo {
  conta: ContaDashboard;
  nome: string;
  pago: Totais;
  naoPago: Totais;
  emAberto: Totais;
  grupos: GrupoResumo[];
  motivos: MotivoResumo[];
}

const zero = (): Totais => ({ qtd: 0, valor: 0 });
const arredondar = (n: number) => Math.round(n * 100) / 100;
const somar = (alvo: Totais, qtd: number, valor: number) => {
  alvo.qtd += qtd;
  alvo.valor = arredondar(alvo.valor + valor);
};

/**
 * Agrega as linhas (conta x grupo x situação x motivo) no formato do dashboard. Todos os grupos
 * esperados de cada conta aparecem, mesmo zerados; grupos inesperados (ex.: "Outros") entram no fim.
 */
export function montarResumo(linhas: LinhaResumo[]): ContaResumo[] {
  return CONTAS.map((conta) => {
    const resumo: ContaResumo = { conta, nome: NOME_CONTA[conta], pago: zero(), naoPago: zero(), emAberto: zero(), grupos: [], motivos: [] };
    const grupos = new Map<string, GrupoResumo>();
    for (const esperado of GRUPOS_POR_CONTA[conta]) {
      grupos.set(esperado.nome, { grupo: esperado.nome, tipo: esperado.tipo, pago: zero(), naoPago: zero(), emAberto: zero(), motivos: [] });
    }
    const motivosConta = new Map<string, MotivoResumo>();

    for (const linha of linhas.filter((l) => l.conta === conta)) {
      const qtd = Number(linha.qtd);
      const valor = Number(linha.valor ?? 0);
      let grupo = grupos.get(linha.grupo);
      if (!grupo) {
        grupo = { grupo: linha.grupo, tipo: 'outro', pago: zero(), naoPago: zero(), emAberto: zero(), motivos: [] };
        grupos.set(linha.grupo, grupo);
      }
      somar(resumo[linha.situacao], qtd, valor);
      somar(grupo[linha.situacao], qtd, valor);

      const codigo = linha.motivo ?? (linha.situacao === 'naoPago' ? 'SEM_MOTIVO' : linha.situacao === 'pago' ? 'EFETIVADO' : 'CRIADO');
      const registrar = (mapa: Map<string, MotivoResumo>) => {
        const chave = `${linha.situacao}|${codigo}`;
        const atual = mapa.get(chave) ?? { codigo, descricao: descreverMotivo(codigo), situacao: linha.situacao, qtd: 0, valor: 0 };
        somar(atual, qtd, valor);
        mapa.set(chave, atual);
      };
      registrar(motivosConta);
      const motivosGrupo = new Map(grupo.motivos.map((m) => [`${m.situacao}|${m.codigo}`, m]));
      registrar(motivosGrupo);
      grupo.motivos = Array.from(motivosGrupo.values());
    }

    const ordemSituacao = (s: SituacaoDashboard) => SITUACOES.indexOf(s);
    const ordenarMotivos = (a: MotivoResumo, b: MotivoResumo) => ordemSituacao(a.situacao) - ordemSituacao(b.situacao) || b.qtd - a.qtd;
    resumo.motivos = Array.from(motivosConta.values()).sort(ordenarMotivos);
    resumo.grupos = Array.from(grupos.values()).map((g) => ({ ...g, motivos: g.motivos.sort(ordenarMotivos) }));
    return resumo;
  });
}
