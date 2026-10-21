import { PagamentoPendenteRepository } from './pagamento-pendente.repository';

describe('PagamentoPendenteRepository.limparPreparo - proteção do pagamento normal do dia', () => {
  const hoje = new Date('2026-10-21T00:00:00Z');

  /** Responde cada consulta pelo trecho de SQL e registra tudo o que foi executado. */
  const build = (respostas: { pais: any[]; detalhes?: any[]; novas?: any[] }) => {
    const executadas: { sql: string; params?: any[] }[] = [];
    const qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string, params?: any[]) => {
        executadas.push({ sql, params });
        if (/FROM pais p/.test(sql)) return respostas.pais;
        if (/SELECT DISTINCT da\.id, da\."headerLoteId"/.test(sql)) return respostas.detalhes ?? [];
        if (/SELECT a\.id FROM ordem_pagamento_agrupado a/.test(sql)) return respostas.novas ?? [];
        if (/RETURNING id/.test(sql)) return [{ id: 1 }];
        return [];
      }),
    };
    const repo = new PagamentoPendenteRepository({ createQueryRunner: () => qr } as any);
    return { repo, qr, executadas };
  };

  it('só apaga como "criada pela pendência" a filha sem pagamento e só com histórico Criado', async () => {
    const { repo, executadas } = build({ pais: [{ opa_id: 100, filhas: [10, 11] }], novas: [{ id: 11 }] });

    const r = await repo.limparPreparo('guardadores', hoje);

    const consultaNovas = executadas.find((e) => /SELECT a\.id FROM ordem_pagamento_agrupado a/.test(e.sql));
    expect(consultaNovas?.sql).toMatch(/NOT EXISTS \(SELECT 1 FROM ordem_pagamento_agrupado_historico h JOIN detalhe_a da/);
    expect(consultaNovas?.sql).toMatch(/h\."statusRemessa" <> \$3/);
    // só a filha 11 (sem pagamento) é apagada; a 10 (pagamento normal do dia) só perde o pai
    const apagaAgrupamento = executadas.filter((e) => /^DELETE FROM ordem_pagamento_agrupado WHERE id = ANY\(\$1\)/.test(e.sql));
    expect(apagaAgrupamento.map((e) => e.params?.[0])).toEqual([[11], [100]]);
    const soltaFilhas = executadas.find((e) => /UPDATE ordem_pagamento_agrupado SET "ordemPagamentoAgrupadoId" = NULL WHERE id = ANY/.test(e.sql));
    expect(soltaFilhas?.params?.[0]).toEqual([10, 11]);
    expect(r).toEqual({ gruposRemovidos: 1, ordensDesvinculadas: 1 });
  });

  it('com o pagamento normal do dia adotado como filha, nenhuma filha é apagada', async () => {
    const { repo, executadas } = build({ pais: [{ opa_id: 100, filhas: [10] }], novas: [] });

    await repo.limparPreparo('guardadores', hoje);

    const apagaAgrupamento = executadas.filter((e) => /^DELETE FROM ordem_pagamento_agrupado WHERE id = ANY\(\$1\)/.test(e.sql));
    expect(apagaAgrupamento.map((e) => e.params?.[0])).toEqual([[100]]);
    expect(executadas.some((e) => /UPDATE ordem_pagamento_guardador SET "ordemPagamentoAgrupadoId" = NULL/.test(e.sql))).toBe(false);
  });

  it('os históricos Criado das filhas só são apagados se não tiverem pagamento (detalhe A)', async () => {
    const { repo, executadas } = build({ pais: [{ opa_id: 100, filhas: [10] }] });

    await repo.limparPreparo('guardadores', hoje);

    const apagaHistorico = executadas.find((e) => /DELETE FROM ordem_pagamento_agrupado_historico h/.test(e.sql));
    expect(apagaHistorico?.sql).toMatch(/NOT EXISTS \(SELECT 1 FROM detalhe_a da WHERE da\."ordemPagamentoAgrupadoHistoricoId" = h\.id\)/);
  });

  it('sem pais de pendência não altera nada', async () => {
    const { repo, executadas, qr } = build({ pais: [] });

    expect(await repo.limparPreparo('permissionarios', hoje)).toEqual({ gruposRemovidos: 0, ordensDesvinculadas: 0 });
    expect(executadas.filter((e) => /^(DELETE|UPDATE)/.test(e.sql))).toHaveLength(0);
    expect(qr.commitTransaction).toHaveBeenCalled();
  });
});
