import { DataSource, QueryRunner } from 'typeorm';
import { RelatorioNovoRemessaConsolidadoRepository } from './relatorio-novo-remessa-consolidado.repository';

describe('RelatorioNovoRemessaConsolidadoRepository', () => {
  let repository: RelatorioNovoRemessaConsolidadoRepository;
  let mockQueryRunner: Partial<QueryRunner>;
  let mockDataSource: Partial<DataSource>;

  // CustomLogger reads this global (set in main.ts) to format timestamps.
  beforeAll(() => {
    (global as any).__localTzOffset = 0;
  });

  beforeEach(() => {
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner as QueryRunner),
    };

    repository = new RelatorioNovoRemessaConsolidadoRepository(mockDataSource as DataSource);
  });

  describe('findConsolidado - no status filter (default todosConsorcios/todosVanzeiros)', () => {
    it('does not union the consorcio status query with itself', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      const queryConsorciosFragment = (repository as any).getQueryConsorcios('2026-01-01', '2026-01-05');
      const occurrences = sql.split(queryConsorciosFragment).length - 1;

      expect(occurrences).toBe(1);
    });

    it('does not union the vanzeiro status query with itself', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      const queryVanzeirosFragment = (repository as any).getQueryVanzeiros('2026-01-01', '2026-01-05');
      const occurrences = sql.split(queryVanzeirosFragment).length - 1;

      expect(occurrences).toBe(1);
    });
  });

  describe('findConsolidado - valor total não duplica favorecido individual de STPC/STPL/TEC', () => {
    it('keeps both the consorcio and the vanzeiro rows, but sums the vanzeiro amount only once', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'STPC', valor: '100.00' },
        { nome: 'João Vanzeiro', valor: '40.00' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
      } as any);

      expect(result.data).toHaveLength(2);
      expect(result.valor).toBe(100);
    });

    it('sums both rows when the selected consorcio does not cover STPC/STPL/TEC', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'VLT', valor: '100.00' },
        { nome: 'João Vanzeiro', valor: '40.00' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        consorcioNome: ['VLT'],
        todosVanzeiros: true,
      } as any);

      expect(result.data).toHaveLength(2);
      expect(result.valor).toBe(140);
    });
  });

  describe('findConsolidado - STUC - Gratuidade', () => {
    it('reads valorGratuidade through the gratuidade grouping, filtered by userIds, with no bind placeholder left over', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        userIds: [10, 20],
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('op."valorGratuidade"');
      expect(sql).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
      expect(sql).toContain(`pu."id" IN('10','20')`);
      expect(sql).not.toMatch(/\$[1-5]\b/);
    });

    it('filters by MODAIS when todosVanzeiros is selected', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        todosVanzeiros: true,
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`op."nomeConsorcio" IN('STPC','STPL','TEC')`);
      expect(sql).toContain(`length(op."operadoraCpfCnpj")<=11`);
    });

    it('filters by a specific consorcio selection', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        consorcioNome: ['VLT'],
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`IN('VLT')`);
    });

    it('does not include any Eleicao/Pendentes marker', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        userIds: [10],
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).not.toContain('op."consorcio"');
      expect(sql).not.toContain('"ordemPagamentoAgrupadoId" is null');
    });

    it('sums every vanzeiro row instead of zeroing the total (STUC has no consorcio-level aggregate row to dedup against)', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'João Vanzeiro', valor: '160.00' },
        { nome: 'Maria Vanzeira', valor: '170.00' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        stucGratuidade: true,
      } as any);

      expect(result.data).toHaveLength(2);
      expect(result.valor).toBe(330);
    });

    it('escapes a single quote in consorcioNome instead of breaking out of the SQL string literal', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        consorcioNome: [`VLT'); DROP TABLE ordem_pagamento; --`],
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`IN('VLT''); DROP TABLE ORDEM_PAGAMENTO; --')`);
      expect(sql).not.toContain(`IN('VLT'); DROP TABLE`);
    });
  });
});

describe('RelatorioNovoRemessaConsolidadoRepository.findConsolidado — filtros', () => {
  const executar = async (filtro: Record<string, unknown>) => {
    const sqls: string[] = [];
    const queryRunner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn((sql: string) => {
        sqls.push(sql);
        return Promise.resolve([]);
      }),
    };
    const repo: any = new RelatorioNovoRemessaConsolidadoRepository({ createQueryRunner: () => queryRunner } as any);
    repo.logger = { debug: jest.fn() };
    await repo.findConsolidado({
      dataInicio: new Date('2026-09-01'),
      dataFim: new Date('2026-09-30'),
      todosConsorcios: true,
      todosVanzeiros: true,
      ...filtro,
    });
    return sqls[0];
  };

  const parentesesBalanceados = (sql: string) => (sql.match(/\(/g) ?? []).length === (sql.match(/\)/g) ?? []).length;
  const semTrechoSolto = (sql: string) => !/\(\s*AND\b|UNION ALL\s+AND\b/i.test(sql);

  it('só Estorno: filtra pelo motivo 02 e gera SQL com parênteses balanceados', async () => {
    const sql = await executar({ estorno: true });
    expect(sql).toContain(`oph."motivoStatusRemessa" IN ('02')`);
    expect(parentesesBalanceados(sql)).toBe(true);
  });

  it('só Rejeitado: filtra pelos motivos AL/HO/ANHO e gera SQL com parênteses balanceados', async () => {
    const sql = await executar({ rejeitado: true });
    expect(sql).toContain(`'AL','HO','ANHO'`);
    expect(parentesesBalanceados(sql)).toBe(true);
  });

  it('Estorno + Pago: motivo e status se somam com OR dentro do mesmo grupo', async () => {
    const sql = await executar({ estorno: true, pago: true });
    expect(sql).toContain(`AND (oph."motivoStatusRemessa" IN ('02') OR oph."statusRemessa" IN (3))`);
    expect(parentesesBalanceados(sql)).toBe(true);
  });

  it('só Aguardando pagamento: consulta apenas o histórico, sem pedaços soltos no UNION', async () => {
    const sql = await executar({ emProcessamento: true });
    expect(sql).toContain(`oph."statusRemessa" IN (1,2)`);
    expect(semTrechoSolto(sql)).toBe(true);
    expect(sql).not.toContain('is null');
  });

  it('OPs atrasadas (pendentes): consulta só as ordens atrasadas, não o histórico', async () => {
    const sql = await executar({ pendentes: true });
    expect(sql).not.toContain('da."dataVencimento"');
    expect(sql).toContain('where (op."ordemPagamentoAgrupadoId" is null)');
    expect(semTrechoSolto(sql)).toBe(true);
    expect(parentesesBalanceados(sql)).toBe(true);
  });

  it('Pendência de pagamento (Todos): inclui status 4, os motivos de Rejeitado/Estorno e as atrasadas', async () => {
    const sql = await executar({ erro: true, pendentes: true });
    expect(sql).toContain(`oph."statusRemessa" IN (4)`);
    expect(sql).toContain(`'AL','HO','ANHO','02'`);
    expect(parentesesBalanceados(sql)).toBe(true);
  });

  it('Eleição a pagar por vanzeiros usa a coluna consorcio de ordem_pagamento_unico', async () => {
    const sql = await executar({ eleicao: true, aPagar: true, todosVanzeiros: true });
    expect(sql).toContain(`op."consorcio" IN`);
    expect(sql).not.toContain(`op."nomeConsorcio"`);
    expect(semTrechoSolto(sql)).toBe(true);
  });

  it('favorecido específico: considera também a ordem do agrupado pai (pendência paga)', async () => {
    const sql = await executar({ userIds: [7], todosConsorcios: undefined, todosVanzeiros: undefined });
    expect(sql).toContain(`pu."id" IN('7') OR puu."id" IN('7')`);
  });

  it('cada pagamento tem seu próprio id na consulta, para o DISTINCT não juntar pagamentos só por terem o mesmo valor', async () => {
    const sql = await executar({ pago: true });
    expect(sql).toContain(`da."id" AS "idLinha"`);
  });

  describe('Pendência Paga: filtra por data de pagamento, não por vencimento', () => {
    it('só Pendência Paga: usa dataPagamento (não dataVencimento) e não some com status=5 solto no filtro de vencimento', async () => {
      const sql = await executar({ pendenciaPaga: true });

      expect(sql).toContain(`op_pai."dataPagamento"::date BETWEEN '2026-09-01'::date AND '2026-09-30'::date`);
      expect(sql).toContain(`opafi."dataPagamento"::date BETWEEN '2026-09-01'::date AND '2026-09-30'::date`);
      // Sem outro status selecionado, a consulta por dataVencimento não deve nem entrar no UNION
      // (senão voltaria status=4 em diante sem filtro de status nenhum).
      expect(sql).not.toContain('da."dataVencimento"');
      expect(sql).not.toContain('oph."statusRemessa" IN (5)');
      expect(parentesesBalanceados(sql)).toBe(true);
    });

    it('replica as guard clauses da query compartilhada: exclui histórico AM/AE e agrupamento com filha', async () => {
      const sql = await executar({ pendenciaPaga: true });

      expect(sql).toContain(`oph."motivoStatusRemessa" NOT IN ('AM', 'AE')`);
      expect(sql).toContain(`NOT EXISTS (SELECT 1 FROM ordem_pagamento_agrupado filha WHERE filha."ordemPagamentoAgrupadoId" = opafi.id)`);
    });

    it('Pendência Paga + Pago: mantém a consulta por dataVencimento para Pago, e soma Pendência Paga à parte por dataPagamento', async () => {
      const sql = await executar({ pendenciaPaga: true, pago: true });

      expect(sql).toContain(`oph."statusRemessa" IN (3)`);
      expect(sql).toContain('da."dataVencimento"');
      expect(sql).toContain(`op_pai."dataPagamento"::date BETWEEN`);
      expect(parentesesBalanceados(sql)).toBe(true);
    });
  });
});
