import { DataSource, DeepPartial, IsNull, Repository } from 'typeorm';
import { OrdemPagamento } from 'src/cnab/novo-remessa/entity/ordem-pagamento.entity';
import {
  CAMPOS_COMPARADOS,
  CAMPOS_GRATUIDADE,
  CampoComparado,
  DadosOrdem,
  camposDivergentes,
  fatia,
  hashOrdem,
  normalizarDadosOrdem,
} from './ordem-sync.utils';

export type ResultadoOrdemSync = 'nova' | 'identica' | 'alterada' | 'contida' | 'alterada_e_contida';

export interface NovaExecucaoSync {
  origem: 'cron' | 'manual';
  usuarioId?: number | null;
  forcar: boolean;
  janelaInicio: string;
  janelaFim: string;
  consorcios?: string[];
}

export interface ContagensExecucaoSync {
  encontradas: number;
  novas: number;
  identicas: number;
  alteradas: number;
  contidas: number;
  ignoradas: number;
  erros: number;
}

export interface LinhaReconciliacao {
  data: string;
  bqQtd: number;
  bqValor: number;
  bdQtd: number;
  bdValor: number;
}

/**
 * Regras do sincronismo de ordens do BigQuery (chave `bqId` + hash):
 *  - nova      -> insere, com auditoria;
 *  - idêntica  -> descarta (só conta no log da execução);
 *  - mudou, ordem ainda livre -> atualiza com o valor novo, com auditoria (antes/depois);
 *  - mudou, ordem contida (já no agrupamento/pagamento) -> NÃO altera: vai para a quarentena, aguardando revisão.
 * Toda decisão que grava algo (insere, atualiza, quarentena) deixa uma linha append-only em `ordem_pagamento_auditoria`.
 */
export class OrdemSyncAuditoria {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordemRepository: Repository<OrdemPagamento>,
  ) {}

  async iniciarExecucao(nova: NovaExecucaoSync): Promise<number> {
    const [linha] = await this.dataSource.query(
      `INSERT INTO sync_execucao (origem, usuario_id, forcar, janela_inicio, janela_fim, consorcios)
       VALUES ($1, $2, $3, $4::date, $5::date, $6) RETURNING id`,
      [nova.origem, nova.usuarioId ?? null, nova.forcar, nova.janelaInicio, nova.janelaFim, nova.consorcios ?? null],
    );
    return Number(linha.id);
  }

  async finalizarExecucao(id: number, status: 'concluida' | 'erro', c: ContagensExecucaoSync, observacao?: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE sync_execucao
          SET finalizada_em = now(), status = $2, encontradas = $3, novas = $4, identicas = $5,
              alteradas = $6, contidas = $7, ignoradas = $8, erros = $9, observacao = $10
        WHERE id = $1`,
      [id, status, c.encontradas, c.novas, c.identicas, c.alteradas, c.contidas, c.ignoradas, c.erros, observacao ?? null],
    );
  }

  /** Ordens já gravadas para os ids do BigQuery informados (uma consulta por lote, não uma por ordem). */
  async buscarPorBqIds(bqIds: number[]): Promise<Map<number, OrdemPagamento>> {
    const mapa = new Map<number, OrdemPagamento>();
    const unicos = [...new Set(bqIds.filter((id) => Number.isFinite(id)))];
    for (let i = 0; i < unicos.length; i += 5000) {
      const lote = unicos.slice(i, i + 5000);
      const encontradas = await this.ordemRepository
        .createQueryBuilder('o')
        .where('o."bqId" = ANY(:ids)', { ids: lote })
        .getMany();
      // Os vínculos são colunas de relação, que o QueryBuilder não preenche nas propriedades *Id da entidade;
      // sem eles toda ordem pareceria "livre". Busca as chaves estrangeiras direto da tabela.
      const vinculos: { id: number; agrupado: number | null; gratuidade: number | null }[] = await this.dataSource.query(
        `SELECT id, "ordemPagamentoAgrupadoId" AS agrupado, "ordemPagamentoAgrupadoGratuidadeId" AS gratuidade
           FROM ordem_pagamento WHERE "bqId" = ANY($1)`,
        [lote],
      );
      const porId = new Map(vinculos.map((v) => [Number(v.id), v]));
      encontradas.forEach((ordem) => {
        const vinculo = porId.get(Number(ordem.id));
        ordem.ordemPagamentoAgrupadoId = vinculo?.agrupado ?? (null as any);
        ordem.ordemPagamentoAgrupadoGratuidadeId = vinculo?.gratuidade ?? null;
        mapa.set(Number(ordem.bqId), ordem);
      });
    }
    return mapa;
  }

  /** Liga ao usuário uma ordem que entrou órfã; só atua se a ordem continua sem usuário e sem agrupamento. */
  async vincularUsuario(ordemId: number, userId: number): Promise<void> {
    await this.ordemRepository.update(
      { id: ordemId, userId: IsNull(), ordemPagamentoAgrupadoId: IsNull(), ordemPagamentoAgrupadoGratuidadeId: IsNull() } as any,
      { userId },
    );
  }

  /**
   * Aplica a regra do sincronismo a uma ordem vinda do BigQuery. `existente` é a ordem já gravada para o
   * mesmo bqId (ou undefined). `novoDto` é a ordem convertida do BigQuery (com userId já resolvido).
   */
  async aplicar(novoDto: DeepPartial<OrdemPagamento>, existente: OrdemPagamento | undefined, execucaoId: number): Promise<ResultadoOrdemSync> {
    const novos = normalizarDadosOrdem(novoDto);
    const hashNovo = hashOrdem(novos);

    if (!existente) {
      const criada = await this.ordemRepository.save(this.ordemRepository.create({ ...novoDto, bqHash: hashNovo }));
      await this.auditar(execucaoId, novos.bqId, criada.id, 'INSERIDA', null, novos, 'Ordem nova do BigQuery (bqId inexistente na base).');
      return 'nova';
    }

    const atuais = normalizarDadosOrdem(existente);
    const hashAtual = existente.bqHash ?? hashOrdem(atuais);
    if (hashAtual === hashNovo && camposDivergentes(atuais, novos).length === 0) {
      return 'identica';
    }

    const divergentes = camposDivergentes(atuais, novos);
    if (divergentes.length === 0) {
      return 'identica';
    }

    const livreNormal = existente.ordemPagamentoAgrupadoId == null;
    const livreGratuidade = existente.ordemPagamentoAgrupadoGratuidadeId == null;
    const aplicaveis: CampoComparado[] = [];
    const contidos: CampoComparado[] = [];
    for (const campo of divergentes) {
      const livre = CAMPOS_GRATUIDADE.includes(campo) ? livreGratuidade : livreNormal;
      (livre ? aplicaveis : contidos).push(campo);
    }

    if (aplicaveis.length > 0) {
      const mudancas: Record<string, unknown> = { bqUpdatedAt: novoDto.bqUpdatedAt };
      aplicaveis.forEach((campo) => {
        mudancas[campo] = (novoDto as Record<string, unknown>)[campo] ?? null;
      });
      const resultante: DadosOrdem = { ...atuais, ...fatia(novos, aplicaveis) };
      mudancas.bqHash = hashOrdem(resultante);
      await this.ordemRepository.update({ id: existente.id }, mudancas as any);
      await this.auditar(
        execucaoId,
        novos.bqId,
        existente.id,
        'ALTERADA',
        fatia(atuais, aplicaveis),
        fatia(novos, aplicaveis),
        `Dados mudaram no BigQuery (${aplicaveis.join(', ')}); ordem ainda livre, atualizada.`,
      );
    }

    if (contidos.length > 0) {
      await this.enviarParaQuarentena(execucaoId, existente, atuais, novos, hashNovo, contidos);
    }

    if (aplicaveis.length > 0 && contidos.length > 0) return 'alterada_e_contida';
    return aplicaveis.length > 0 ? 'alterada' : 'contida';
  }

  private async enviarParaQuarentena(
    execucaoId: number,
    existente: OrdemPagamento,
    atuais: DadosOrdem,
    novos: DadosOrdem,
    hashNovo: string,
    contidos: CampoComparado[],
  ): Promise<void> {
    // Esta versão do BigQuery já foi para a quarentena (pendente, aprovada ou rejeitada): não repete.
    const [jaExiste] = await this.dataSource.query(
      `SELECT 1 FROM ordem_pagamento_quarentena WHERE bq_id = $1 AND hash_bq = $2 LIMIT 1`,
      [novos.bqId, hashNovo],
    );
    if (jaExiste) return;

    const vinculos = [
      existente.ordemPagamentoAgrupadoId != null ? `agrupamento ${existente.ordemPagamentoAgrupadoId}` : null,
      existente.ordemPagamentoAgrupadoGratuidadeId != null ? `agrupamento de gratuidade ${existente.ordemPagamentoAgrupadoGratuidadeId}` : null,
    ].filter(Boolean);
    const motivo = `Ordem contida (${vinculos.join(' e ')}): o BigQuery trouxe outros valores para ${contidos.join(', ')}; aguardando revisão.`;

    await this.dataSource.query(
      `INSERT INTO ordem_pagamento_quarentena (execucao_id, bq_id, ordem_pagamento_id, hash_bq, dados_bq, dados_atuais, campos_divergentes, motivo)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
       ON CONFLICT DO NOTHING`,
      [execucaoId, novos.bqId, existente.id, hashNovo, JSON.stringify(novos), JSON.stringify(atuais), contidos, motivo],
    );
    await this.auditar(execucaoId, novos.bqId, existente.id, 'QUARENTENA', fatia(atuais, contidos), fatia(novos, contidos), motivo);
  }

  async auditar(
    execucaoId: number | null,
    bqId: number | null,
    ordemId: number | null,
    acao: 'INSERIDA' | 'ALTERADA' | 'QUARENTENA' | 'APROVADA' | 'REJEITADA',
    antes: unknown,
    depois: unknown,
    motivo: string,
    usuarioId?: number | null,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO ordem_pagamento_auditoria (execucao_id, bq_id, ordem_pagamento_id, acao, antes, depois, motivo, usuario_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
      [execucaoId, bqId, ordemId, acao, antes == null ? null : JSON.stringify(antes), depois == null ? null : JSON.stringify(depois), motivo, usuarioId ?? null],
    );
  }

  /** Contagem e soma do banco por dia de captura, para o mesmo recorte do BigQuery. */
  async contagemDiariaBanco(inicio: string, fim: string, consorcios: string[]): Promise<Map<string, { qtd: number; valor: number }>> {
    const linhas: { dia: string; qtd: string; valor: string }[] = await this.dataSource.query(
      `SELECT to_char("dataCaptura"::date, 'YYYY-MM-DD') AS dia, count(*) AS qtd, COALESCE(sum(valor), 0) AS valor
         FROM ordem_pagamento
        WHERE "dataCaptura" >= $1::date AND "dataCaptura" < ($2::date + 1) AND "nomeConsorcio" = ANY($3)
        GROUP BY 1`,
      [inicio, fim, consorcios],
    );
    return new Map(linhas.map((l) => [l.dia, { qtd: Number(l.qtd), valor: Number(l.valor) }]));
  }

  async salvarReconciliacao(linhas: LinhaReconciliacao[], execucaoId: number | null): Promise<void> {
    for (const l of linhas) {
      await this.dataSource.query(
        `INSERT INTO ordem_pagamento_reconciliacao_diaria (data, bq_qtd, bq_valor, bd_qtd, bd_valor, dif_qtd, dif_valor, execucao_id, calculado_em)
         VALUES ($1::date, $2::int, $3::numeric, $4::int, $5::numeric, $2::int - $4::int, ROUND(($3::numeric - $5::numeric), 2), $6, now())
         ON CONFLICT (data) DO UPDATE SET bq_qtd = EXCLUDED.bq_qtd, bq_valor = EXCLUDED.bq_valor, bd_qtd = EXCLUDED.bd_qtd,
           bd_valor = EXCLUDED.bd_valor, dif_qtd = EXCLUDED.dif_qtd, dif_valor = EXCLUDED.dif_valor,
           execucao_id = EXCLUDED.execucao_id, calculado_em = now()`,
        [l.data, l.bqQtd, l.bqValor, l.bdQtd, l.bdValor, execucaoId],
      );
    }
  }
}

export { CAMPOS_COMPARADOS };
