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

  // ADR 0011: getQueryConsorcios/getQueryVanzeiros (histórico normal) não excluíam agrupamentos
  // substituídos/reenviados, ao contrário de getQueryPendenciaPagaConsorcios/Vanzeiros no mesmo
  // arquivo. Hoje isso não quebra o valor total (o SELECT DISTINCT colapsa essas linhas em
  // "nome"/"nome2" nulos, descartados pelo filtro externo) mas é um acidente, não um design.
  describe('getQueryConsorcios/getQueryVanzeiros - exclui agrupamentos substituídos/reenviados', () => {
    it.each([
      ['getQueryConsorcios', () => (repository as any).getQueryConsorcios('2026-01-01', '2026-01-05')],
      ['getQueryVanzeiros', () => (repository as any).getQueryVanzeiros('2026-01-01', '2026-01-05')],
    ])('%s excludes agrupamentos that have a child agrupamento (filha)', (_name, build) => {
      const sql: string = build();

      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain('ordem_pagamento_agrupado filha');
      expect(sql).toContain('filha."ordemPagamentoAgrupadoId" = opafi.id');
    });

    it.each([
      ['getQueryConsorcios', () => (repository as any).getQueryConsorcios('2026-01-01', '2026-01-05')],
      ['getQueryVanzeiros', () => (repository as any).getQueryVanzeiros('2026-01-01', '2026-01-05')],
    ])('%s excludes motivoStatusRemessa AM/AE', (_name, build) => {
      const sql: string = build();

      expect(sql).toContain(`motivoStatusRemessa" NOT IN ('AM', 'AE')`);
    });

    // Regressão negativa: as queries de Pendência Paga do mesmo arquivo já tinham os dois
    // guards antes desta mudança e não devem ser afetadas.
    it.each([
      ['getQueryPendenciaPagaConsorcios', () => (repository as any).getQueryPendenciaPagaConsorcios('2026-01-01', '2026-01-05')],
      ['getQueryPendenciaPagaVanzeiros', () => (repository as any).getQueryPendenciaPagaVanzeiros('2026-01-01', '2026-01-05')],
    ])('%s keeps its existing guards unchanged', (_name, build) => {
      const sql: string = build();

      expect(sql).toContain('NOT EXISTS');
      expect(sql).toContain(`motivoStatusRemessa" NOT IN ('AM', 'AE')`);
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

    it('combines status/motivo with OR for "Pendência de Pagamento" (Todos), same as the normal flow, including the statusRemessa=4-with-motivo!=02 Rejeitado bucket (not a fixed motivo list, so rows like "AR" are classified as Rejeitado same as Movimentação Financeira/STATUS_CASE ELSE)', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        userIds: [10],
        stucGratuidade: true,
        erro: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`AND (oph."motivoStatusRemessa" IN ('02') OR oph."statusRemessa" IN (4) OR (oph."statusRemessa" = 4 AND (oph."motivoStatusRemessa" IS NULL OR oph."motivoStatusRemessa" <> '02')))`);
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

    it('excludes the MODAIS/CPF slice from the consorcio branch when no favorecido/consorcio is selected (both branches default to true and MODAIS ⊆ CONSORCIOS, which double-counted every STUC vanzeiro row)', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`AND NOT (op."nomeConsorcio" IN('STPC','STPL','TEC') AND length(op."operadoraCpfCnpj")<=11)`);
    });

    it('does not exclude the MODAIS/CPF slice when a specific favorecido is selected (only the vanzeiro branch runs, nothing to dedup)', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        userIds: [10],
        stucGratuidade: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).not.toContain('AND NOT (op."nomeConsorcio"');
    });

    it('sums every vanzeiro row instead of zeroing the total (STUC has no consorcio-level aggregate row to dedup against)', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'João Vanzeiro', cpfCnpj: '1', dataReferencia: '23/10/2026', valor: '160.00' },
        { nome: 'Maria Vanzeira', cpfCnpj: '2', dataReferencia: '23/10/2026', valor: '170.00' },
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

    // Bug (ver ADR 0008): "A pagar" e "Pendência Paga" eram aceitos na tela junto com STUC -
    // Gratuidade, mas o backend os ignorava silenciosamente, devolvendo o mesmo total de "Todos".
    it('"A pagar" filtra pelo bucket cru statusRemessa 0/1 (STATUS_CASE "A Pagar"), em vez de ser ignorado', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        userIds: [10],
        stucGratuidade: true,
        aPagar: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`AND (oph."statusRemessa" IN (0,1)) `);
    });

    it('"Pendência Paga" usa a consulta por data de pagamento (gratuidade), não fica sem efeito', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        userIds: [10],
        stucGratuidade: true,
        pendenciaPaga: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('op."ordemPagamentoAgrupadoGratuidadeId" = opa.id');
      expect(sql).toContain('op."valorGratuidade" AS valor');
      expect(sql).toContain(`op_pai."dataPagamento"::date BETWEEN '2026-01-01'::date AND '2026-01-05'::date`);
      expect(sql).toContain(`pu."id" IN('10')`);
      expect(sql).not.toMatch(/\$[1-5]\b/);
    });

    it('"Pendência Paga" + "Todos vanzeiros": filtra por MODAIS/CPF igual ao ramo normal do STUC', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-01-01'),
        dataFim: new Date('2026-01-05'),
        todosVanzeiros: true,
        stucGratuidade: true,
        pendenciaPaga: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`op."nomeConsorcio" IN('STPC','STPL','TEC')`);
      expect(sql).toContain(`length(op."operadoraCpfCnpj")<=11`);
    });

    // Bug: em dia único (De === Até), "Pendência de Pagamento" (Estorno/Rejeitado) usava a mesma
    // consulta geral por dataVencimento das demais abas - sem a cadeia de retentativa (op_pai),
    // perdia/colapsava dias de uma janela STUC cuja tentativa mais recente não cai no próprio dia
    // filtrado. Movimentação Financeira já trocava para a consulta ciente de retentativa
    // (buildStucGratuidadePendenciaPagamentoSingleDateQuery) nesse caso; Consolidado não.
    it('"Pendência de Pagamento" (Todos) em dia único usa a consulta ciente de retentativa, igual à Movimentação Financeira', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-10-16'),
        dataFim: new Date('2026-10-16'),
        userIds: [10],
        stucGratuidade: true,
        erro: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      // Consulta ciente de retentativa: usa a data real da ordem (ADR 0012/pivot), não a data de
      // pagamento da tentativa, e junta oph_pai para achar a tentativa mais recente da família.
      expect(sql).toContain('da."dataVencimento" AS "dataReferencia"');
      expect(sql).toContain('ordem_pagamento_agrupado_historico oph_pai');
      expect(sql).toContain(`IN ('Estorno', 'Rejeitado')`);
      expect(sql).not.toMatch(/\$[1-5]\b/);
    });

    it('"Pendência de Pagamento" (Todos) em dia único não duplica linhas entre a consulta geral e a de retentativa', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-10-16'),
        dataFim: new Date('2026-10-16'),
        userIds: [10],
        stucGratuidade: true,
        erro: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      // A consulta geral (buildStucGratuidadeQuery) não deve mais filtrar por Estorno/Rejeitado -
      // sem FALSE aqui ela voltaria a trazer status=4 sem a cadeia de retentativa, duplicando.
      expect(sql).toContain('AND FALSE');
    });

    it('"Pendência de Pagamento" (Todos) num intervalo de mais de um dia continua usando só a consulta geral (comportamento existente preservado)', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-10-14'),
        dataFim: new Date('2026-10-16'),
        userIds: [10],
        stucGratuidade: true,
        erro: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain(`AND (oph."motivoStatusRemessa" IN ('02') OR oph."statusRemessa" IN (4) OR (oph."statusRemessa" = 4 AND (oph."motivoStatusRemessa" IS NULL OR oph."motivoStatusRemessa" <> '02')))`);
      expect(sql).not.toContain('ordem_pagamento_agrupado_historico oph_pai');
    });
  });

  describe('findConsolidado - STUC - Gratuidade payment window columns (ADR 0012)', () => {
    it('pivots a complete 4-day window into one row with the 4 pairs filled and valor summed', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '23/10/2026', valor: '10' },
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '24/10/2026', valor: '20' },
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '25/10/2026', valor: '30' },
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '26/10/2026', valor: '40' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-26'),
        stucGratuidade: true,
      } as any);

      expect(result.data).toHaveLength(1);
      const [row] = result.data as any[];
      expect(row.dataOrdemPagamento1).toBe('23/10/2026');
      expect(row.valorOrdemPagamento1).toBe(10);
      expect(row.dataOrdemPagamento4).toBe('26/10/2026');
      expect(row.valorOrdemPagamento4).toBe(40);
      expect(row.valor).toBe(100);
      expect(result.valor).toBe(100);
    });

    it('pivots correctly when pg returns "dataReferencia" as a native Date (not a string)', async () => {
      // Regressão: "dataReferencia" vem de uma coluna timestamp (da."dataVencimento") sem
      // to_char no SQL deste método - node-postgres entrega isso como Date, não string. Um
      // mock só com string mascarava esse caso e deixava passar um parse(Date, 'dd/MM/yyyy')
      // que sempre resultava em Invalid Date (erro 400 "Invalid time value" em runtime real).
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: new Date('2026-10-23T00:00:00.000Z'), valor: '10' },
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: new Date('2026-10-24T00:00:00.000Z'), valor: '20' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-24'),
        stucGratuidade: true,
      } as any);

      const [row] = result.data as any[];
      expect(row.dataOrdemPagamento1).toBe('23/10/2026');
      expect(row.valorOrdemPagamento1).toBe(10);
      expect(row.dataOrdemPagamento2).toBe('24/10/2026');
      expect(row.valorOrdemPagamento2).toBe(20);
      expect(row.valor).toBe(30);
    });

    it('leaves the 4th pair empty for a 3-day (Tue-Thu) window', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '27/10/2026', valor: '1' },
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '28/10/2026', valor: '2' },
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '29/10/2026', valor: '3' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-10-27'),
        dataFim: new Date('2026-10-29'),
        stucGratuidade: true,
      } as any);

      const [row] = result.data as any[];
      expect(row.dataOrdemPagamento4).toBeFalsy();
      expect(row.valorOrdemPagamento4).toBeFalsy();
      expect(row.valor).toBe(6);
    });

    it('splits two different payment windows for the same favorecido into two rows, and sums both into the report total', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '23/10/2026', valor: '10' },
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '27/10/2026', valor: '20' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-29'),
        stucGratuidade: true,
      } as any);

      expect(result.data).toHaveLength(2);
      expect(result.valor).toBe(30);
    });

    it('filters by the window total (Vlr Min/Max), not by the favorecido grand total', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '23/10/2026', valor: '10' },
        { nome: 'Fulano', cpfCnpj: '1', dataReferencia: '27/10/2026', valor: '200' },
      ]);

      const result = await repository.findConsolidado({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-29'),
        stucGratuidade: true,
        valorMin: 100,
        valorMax: 300,
      } as any);

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as any).valor).toBe(200);
    });

    it('paginates the pivoted rows in memory without dropping or duplicating windows across pages', async () => {
      (mockQueryRunner.query as jest.Mock).mockResolvedValue([
        { nome: 'Ana', cpfCnpj: '1', dataReferencia: '23/10/2026', valor: '10' },
        { nome: 'Bruno', cpfCnpj: '2', dataReferencia: '23/10/2026', valor: '20' },
        { nome: 'Carla', cpfCnpj: '3', dataReferencia: '23/10/2026', valor: '30' },
      ]);

      const page1 = await repository.findConsolidado({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-23'),
        stucGratuidade: true,
        page: 1,
        pageSize: 2,
      } as any);
      const page2 = await repository.findConsolidado({
        dataInicio: new Date('2026-10-23'),
        dataFim: new Date('2026-10-23'),
        stucGratuidade: true,
        page: 2,
        pageSize: 2,
      } as any);

      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(1);
      expect(page1.count).toBe(3);
      const allNomes = [...page1.data, ...page2.data].map((r: any) => r.nomefavorecido).sort();
      expect(allNomes).toEqual(['Ana', 'Bruno', 'Carla']);
    });
  });

  // ADR 0012: STUC - Gratuidade explode cada dia da janela de pagamento em sua própria entrada
  // (dataReferencia por dia, não a data de pagamento da janela toda) antes do pivot. Isso vale
  // para TODOS os status filtráveis na tela, não só o fluxo "sem filtro" - um gap aqui faz
  // pivotStucGratuidadeRows receber uma linha por janela em vez de uma por dia, colapsando os
  // dias distintos numa única coluna/linha (o mesmo bug que a correção de Estorno/Rejeitado em
  // dia único, acima, fechou para esse status específico).
  describe('findConsolidado - STUC - Gratuidade: dataReferencia é por dia em todos os status (Todos, A pagar, Pago, Aguardando Pagamento, Pendência de Pagamento, Pendência Paga)', () => {
    const casosPorDiaUnico: Array<{ label: string; filtro: Record<string, unknown> }> = [
      { label: 'Todos', filtro: {} },
      { label: 'A pagar', filtro: { aPagar: true } },
      { label: 'Pago', filtro: { pago: true } },
      { label: 'Aguardando Pagamento', filtro: { emProcessamento: true } },
      { label: 'Pendência Paga', filtro: { pendenciaPaga: true } },
    ];

    it.each(casosPorDiaUnico)('$label: usa da."dataVencimento" como dataReferencia (por dia, não por janela)', async ({ filtro }) => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-10-16'),
        dataFim: new Date('2026-10-16'),
        userIds: [10],
        stucGratuidade: true,
        ...filtro,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('da."dataVencimento" AS "dataReferencia"');
    });

    it('Pendência de Pagamento (Estorno/Rejeitado): usa da."dataVencimento" como dataReferencia via a consulta ciente de retentativa (dia único)', async () => {
      await repository.findConsolidado({
        dataInicio: new Date('2026-10-16'),
        dataFim: new Date('2026-10-16'),
        userIds: [10],
        stucGratuidade: true,
        erro: true,
      } as any);

      const sql = (mockQueryRunner.query as jest.Mock).mock.calls[0][0];
      expect(sql).toContain('da."dataVencimento" AS "dataReferencia"');
      expect(sql).not.toContain('op_pai."dataPagamento" AS "dataReferencia"');
      expect(sql).not.toContain('opa."dataPagamento" AS "dataReferencia"');
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

  it('só Rejeitado: filtra por statusRemessa=4 com motivo != 02 (não uma lista fixa de motivos) e gera SQL com parênteses balanceados', async () => {
    const sql = await executar({ rejeitado: true });
    expect(sql).toContain(`(oph."statusRemessa" = 4 AND (oph."motivoStatusRemessa" IS NULL OR oph."motivoStatusRemessa" <> '02'))`);
    expect(parentesesBalanceados(sql)).toBe(true);
  });

  it('Estorno + Pago: motivo e status se somam com OR dentro do mesmo grupo', async () => {
    const sql = await executar({ estorno: true, pago: true });
    expect(sql).toContain(`AND (oph."motivoStatusRemessa" IN ('02') OR oph."statusRemessa" IN (3))`);
    expect(parentesesBalanceados(sql)).toBe(true);
  });

  it('só Aguardando pagamento: filtra só statusRemessa=2 (1 é "A Pagar", outro bucket), sem pedaços soltos no UNION', async () => {
    const sql = await executar({ emProcessamento: true });
    expect(sql).toContain(`oph."statusRemessa" IN (2)`);
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

  it('Pendência de pagamento (Todos): inclui status 4, o motivo de Estorno, o Rejeitado (status 4 != 02) e as atrasadas', async () => {
    const sql = await executar({ erro: true, pendentes: true });
    expect(sql).toContain(`oph."statusRemessa" IN (4)`);
    expect(sql).toContain(`oph."motivoStatusRemessa" IN ('02')`);
    expect(sql).toContain(`(oph."statusRemessa" = 4 AND (oph."motivoStatusRemessa" IS NULL OR oph."motivoStatusRemessa" <> '02'))`);
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
