import { OrdemPagamentoRepository } from './ordem-pagamento.repository';

describe('OrdemPagamentoRepository.findFavorecidosAcimaDoLimiteNoCiclo', () => {
  const build = () => {
    const typeormRepo = { query: jest.fn().mockResolvedValue([]) };
    const repo = new OrdemPagamentoRepository(typeormRepo as any, {} as any);
    return { repo, typeormRepo };
  };

  const getSql = (typeormRepo: { query: jest.Mock }) => (typeormRepo.query.mock.calls[0][0] as string).replace(/\s+/g, ' ');

  it('passes threshold, normalized consórcios and the cycle dates as parameters', async () => {
    const { repo, typeormRepo } = build();

    await repo.findFavorecidosAcimaDoLimiteNoCiclo('2026-11-20', '2026-11-23', 15000, [' stpc ', 'STPL', 'tec']);

    expect(typeormRepo.query).toHaveBeenCalledWith(expect.any(String), [15000, ['STPC', 'STPL', 'TEC'], '2026-11-20', '2026-11-23']);
  });

  it('sums the orders of each favorecido captured in the cycle and compares the sum with the threshold', async () => {
    const { repo, typeormRepo } = build();

    await repo.findFavorecidosAcimaDoLimiteNoCiclo('2026-11-20', '2026-11-23', 15000, ['STPL']);

    const sql = getSql(typeormRepo);
    expect(sql).toContain('FROM ordem_pagamento op');
    expect(sql).toContain('op."dataCaptura"::date BETWEEN $3::date AND $4::date');
    expect(sql).toContain('GROUP BY op."userId"');
    expect(sql).toContain('HAVING SUM(op.valor) > $1');
    expect(sql).toContain('op."userId" IS NOT NULL');
  });

  it('does not depend on the grouping (agrupadas and não agrupadas count)', async () => {
    const { repo, typeormRepo } = build();

    await repo.findFavorecidosAcimaDoLimiteNoCiclo('2026-11-20', '2026-11-23', 15000, ['STPL']);

    const sql = getSql(typeormRepo);
    expect(sql).not.toContain('ordemPagamentoAgrupadoId');
    expect(sql).not.toContain('ordem_pagamento_agrupado');
    expect(sql).toContain(`UPPER(TRIM(COALESCE(op."nomeConsorcio", ''))) = ANY($2)`);
  });

  it('returns the orders of each favorecido (id, dates, value) in the same query, ordered by capture', async () => {
    const { repo, typeormRepo } = build();

    await repo.findFavorecidosAcimaDoLimiteNoCiclo('2026-11-20', '2026-11-23', 15000, ['STPL']);

    const sql = getSql(typeormRepo);
    expect(sql).toMatch(/json_agg\( json_build_object\(.*'valor', op\.valor.*\) ORDER BY op\."dataCaptura" ASC, op\.id ASC \) AS "ordens"/);
  });

  it('maps numeric columns returned as strings by pg to numbers, including each order value', async () => {
    const { repo, typeormRepo } = build();
    const ordens = [
      { id: 1069151, idOrdemPagamento: 'OP-1', dataOrdem: '2026-11-20', dataCaptura: '2026-11-21T10:00:00Z', valor: '4895.00000' },
      { id: 1073861, idOrdemPagamento: null, dataOrdem: '2026-11-23', dataCaptura: '2026-11-23T10:00:00Z', valor: 5675 },
    ];
    const row = {
      userId: 1426,
      nomeOperadora: 'Operadora Teste',
      nomeConsorcio: 'STPL',
      quantidadeOrdens: '2',
      valorTotal: '10570.00000',
      primeiraCaptura: new Date('2026-11-21T10:00:00.000Z'),
      ultimaCaptura: new Date('2026-11-23T10:00:00.000Z'),
      ordens,
    };
    typeormRepo.query.mockResolvedValue([row]);

    const result = await repo.findFavorecidosAcimaDoLimiteNoCiclo('2026-11-20', '2026-11-23', 15000, ['STPL']);

    expect(result).toEqual([
      {
        ...row,
        valorTotal: 10570,
        quantidadeOrdens: 2,
        ordens: [
          { ...ordens[0], valor: 4895 },
          { ...ordens[1], valor: 5675 },
        ],
      },
    ]);
  });
});
