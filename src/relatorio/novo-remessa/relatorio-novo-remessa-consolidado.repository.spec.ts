import { RelatorioNovoRemessaConsolidadoRepository } from './relatorio-novo-remessa-consolidado.repository';

describe('RelatorioNovoRemessaConsolidadoRepository.findConsolidado — filtros', () => {
  const executar = async (filtro: Record<string, unknown>) => {
    const sqls: string[] = [];
    const queryRunner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) => {
        sqls.push(sql);
        return [];
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
});
