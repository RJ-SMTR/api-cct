import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
import { ConsolidadoCombinadoService } from './consolidado-combinado.service';
import { RelatorioNovoRemessaService } from '../novo-remessa/relatorio-novo-remessa.service';
import { ConsolidadoV2Controller } from './consolidado-v2.controller';
import { ConsorcioAggregatorService } from './consorcio-aggregator.service';
import { EleicaoAggregatorService } from './eleicao-aggregator.service';
import { StucGratuidadeAggregatorService } from './stuc-gratuidade-aggregator.service';
import { VanzeiroAggregatorService } from './vanzeiro-aggregator.service';

describe('ConsolidadoV2Controller', () => {
  let controller: ConsolidadoV2Controller;
  let vanzeiroAggregatorService: VanzeiroAggregatorService;
  let consorcioAggregatorService: ConsorcioAggregatorService;
  let eleicaoAggregatorService: EleicaoAggregatorService;
  let stucGratuidadeAggregatorService: StucGratuidadeAggregatorService;
  let consolidadoCombinadoService: ConsolidadoCombinadoService;
  let relatorioNovoRemessaService: RelatorioNovoRemessaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsolidadoV2Controller],
      providers: [
        { provide: VanzeiroAggregatorService, useValue: { aggregate: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
        { provide: ConsorcioAggregatorService, useValue: { aggregate: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
        { provide: EleicaoAggregatorService, useValue: { aggregateByFavorecido: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }), aggregateByConsorcio: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
        { provide: StucGratuidadeAggregatorService, useValue: { aggregate: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
        { provide: ConsolidadoCombinadoService, useValue: { aggregate: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
        { provide: RelatorioNovoRemessaService, useValue: { findConsolidado: jest.fn().mockResolvedValue({ count: 0, valor: 0, data: [] }) } },
      ],
    }).compile();

    controller = module.get(ConsolidadoV2Controller);
    vanzeiroAggregatorService = module.get(VanzeiroAggregatorService);
    consorcioAggregatorService = module.get(ConsorcioAggregatorService);
    eleicaoAggregatorService = module.get(EleicaoAggregatorService);
    stucGratuidadeAggregatorService = module.get(StucGratuidadeAggregatorService);
    consolidadoCombinadoService = module.get(ConsolidadoCombinadoService);
    relatorioNovoRemessaService = module.get(RelatorioNovoRemessaService);
  });

  const dataInicio = new Date('2098-01-01');
  const dataFim = new Date('2098-01-31');

  // Sem favorecido nem consorcio, a rota une as duas visoes (como o legado). Os testes que nao
  // tratam disso selecionam "Favorecido = Todos" por padrao.
  async function callController(overrides: Partial<Record<string, any>> = {}) {
    const escolheuVisao = ['todosVanzeiros', 'userIds', 'consorcioNome', 'todosConsorcios'].some((campo) => campo in overrides);
    const defaults = {
      userIds: undefined,
      consorcioNome: undefined,
      valorMin: undefined,
      valorMax: undefined,
      pago: undefined,
      aPagar: undefined,
      emProcessamento: undefined,
      todosVanzeiros: escolheuVisao ? undefined : true,
      todosConsorcios: undefined,
      eleicao: undefined,
      desativados: undefined,
      pendentes: undefined,
      rejeitado: undefined,
      estorno: undefined,
      pendenciaPaga: undefined,
      stucGratuidade: undefined,
      erro: undefined,
      ...overrides,
    };

    return controller.getConsolidado(
      dataInicio,
      dataFim,
      defaults.userIds,
      defaults.consorcioNome,
      defaults.valorMin,
      defaults.valorMax,
      defaults.pago,
      defaults.aPagar,
      defaults.emProcessamento,
      defaults.todosVanzeiros,
      defaults.todosConsorcios,
      defaults.eleicao,
      defaults.desativados,
      defaults.pendentes,
      defaults.rejeitado,
      defaults.estorno,
      defaults.pendenciaPaga,
      defaults.stucGratuidade,
      defaults.erro,
    );
  }

  it('calls the favorecido aggregator (T3) when neither consorcioNome nor todosConsorcios is present', async () => {
    await callController({ pago: true });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ dataInicio, dataFim, statuses: [StatusPagamento.PAGO] }),
    );
    expect(consorcioAggregatorService.aggregate).not.toHaveBeenCalled();
  });

  it('calls the consorcio aggregator (T4) when todosConsorcios is true', async () => {
    await callController({ todosConsorcios: true });

    expect(consorcioAggregatorService.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ dataInicio, dataFim }),
      expect.objectContaining({ todosConsorcios: true }),
    );
    expect(vanzeiroAggregatorService.aggregate).not.toHaveBeenCalled();
  });

  it('routes to the combined view when todosVanzeiros and todosConsorcios are both true', async () => {
    await callController({ todosVanzeiros: true, todosConsorcios: true, pago: true, valorMax: 10 });

    expect(consolidadoCombinadoService.aggregate).toHaveBeenCalledWith(expect.objectContaining({ dataInicio, dataFim, valorMax: 10, statuses: [StatusPagamento.PAGO] }), expect.objectContaining({ todosVanzeiros: true, todosConsorcios: true }));
    expect(consorcioAggregatorService.aggregate).not.toHaveBeenCalled();
    expect(vanzeiroAggregatorService.aggregate).not.toHaveBeenCalled();
  });

  // AuthGuard('jwt') enforcement itself (a real 401 without a token) is an HTTP-level concern,
  // verified at the e2e seam (T6) - a unit spec that calls the controller method directly
  // bypasses the Nest guard pipeline entirely. Here we assert the guard decorator is present,
  // so the route cannot silently lose its auth protection without this spec catching it.
  it('has AuthGuard(jwt) applied to getConsolidado', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ConsolidadoV2Controller.prototype.getConsolidado);
    expect(guards).toBeDefined();
    expect(guards.length).toBeGreaterThan(0);
  });

  it('forwards desativados to the favorecido view', async () => {
    await callController({ desativados: true });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(expect.objectContaining({ desativados: true }));
  });

  it('forwards userIds to the favorecido aggregator', async () => {
    await callController({ userIds: [7, 8], pago: true });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [7, 8], statuses: [StatusPagamento.PAGO] }),
    );
  });

  // Legado: "todosVanzeiros" tem prioridade sobre o favorecido especifico.
  it('ignores userIds when todosVanzeiros is true, like legacy', async () => {
    await callController({ userIds: [7], todosVanzeiros: true });

    const calledFilter = (vanzeiroAggregatorService.aggregate as jest.Mock).mock.calls[0][0];
    expect(calledFilter.userIds).toBeUndefined();
  });

  // Legado une as duas visoes nesse caso; sem suporte aqui, erro explicito e nunca ignorado.
  it('maps pendentes to StatusPagamento.PENDENTES', async () => {
    await callController({ pendentes: true });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(expect.objectContaining({ statuses: [StatusPagamento.PENDENTES] }));
  });

  // T1 (fatia 2): pendenciaPaga/rejeitado/estorno/erro deixam de ser rejeitados e passam a
  // mapear para o StatusPagamento correspondente, mesma semantica do getSelectedStatuses legado.
  it('maps pendenciaPaga to StatusPagamento.PENDENCIA_PAGA', async () => {
    await callController({ pendenciaPaga: true });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: [StatusPagamento.PENDENCIA_PAGA] }),
    );
  });

  it('maps rejeitado to StatusPagamento.ERRO_REJEITADO', async () => {
    await callController({ rejeitado: true });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: [StatusPagamento.ERRO_REJEITADO] }),
    );
  });

  it('maps estorno to StatusPagamento.ERRO_ESTORNO', async () => {
    await callController({ estorno: true });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: [StatusPagamento.ERRO_ESTORNO] }),
    );
  });

  it('maps erro=true to the combo ERRO_ESTORNO + ERRO_REJEITADO', async () => {
    await callController({ erro: true });

    const calledFilter = (vanzeiroAggregatorService.aggregate as jest.Mock).mock.calls[0][0];
    expect(calledFilter.statuses).toHaveLength(2);
    expect(calledFilter.statuses).toEqual(
      expect.arrayContaining([StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO]),
    );
  });

  it('does not duplicate statuses when erro=true is combined with rejeitado/estorno individually', async () => {
    await callController({ erro: true, rejeitado: true, estorno: true });

    const calledFilter = (vanzeiroAggregatorService.aggregate as jest.Mock).mock.calls[0][0];
    expect(calledFilter.statuses).toHaveLength(2);
  });

  it('combines pendenciaPaga with pago/aPagar in the same filter without rejecting', async () => {
    await callController({ pendenciaPaga: true, pago: true, aPagar: true });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: expect.arrayContaining([StatusPagamento.PENDENCIA_PAGA, StatusPagamento.PAGO, StatusPagamento.A_PAGAR]),
      }),
    );
  });

  // T2 da fatia 2 (ADR 0021/0022): "eleicao" saiu de OUT_OF_SCOPE_FLAGS, mas sem suporte a
  // userIds/consorcioNome/todosConsorcios ainda (OQ-1 do PRD, opcao (b)) - combinar deve
  // continuar sendo 400 explicito, nunca ignorado silenciosamente.
  // STUC tem roteamento proprio; o filtro de consorcio vai para o repositorio.
  // STUC nao tem fonte de Pendentes: o legado devolveria todos os status nesse caso.
  describe('getGuardadorConsolidado', () => {
    async function callGuardador(overrides: Partial<Record<string, any>> = {}) {
      const d: Record<string, any> = { ...overrides };
      return controller.getGuardadorConsolidado(
        dataInicio,
        dataFim,
        d.userIds,
        d.consorcioNome,
        d.valorMin,
        d.valorMax,
        d.pago,
        d.aPagar,
        d.emProcessamento,
        d.todosConsorcios,
        d.eleicao,
        d.desativados,
        d.pendentes,
        d.rejeitado,
        d.estorno,
        d.pendenciaPaga,
        d.stucGratuidade,
        d.erro,
      );
    }

    it('has AuthGuard(jwt) applied', () => {
      const guards = Reflect.getMetadata(GUARDS_METADATA, ConsolidadoV2Controller.prototype.getGuardadorConsolidado);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });

    it('aggregates by favorecido with the guardador perfil and the mapped statuses', async () => {
      await callGuardador({ pago: true, pendenciaPaga: true, valorMin: 10 });

      expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          dataInicio,
          dataFim,
          valorMin: 10,
          statuses: expect.arrayContaining([StatusPagamento.PAGO, StatusPagamento.PENDENCIA_PAGA]),
        }),
        'guardador',
      );
    });

    it('forwards userIds with the guardador perfil', async () => {
      await callGuardador({ userIds: [7, 8], pago: true });

      expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(expect.objectContaining({ userIds: [7, 8] }), 'guardador');
    });

    it('maps erro=true to Estorno + Rejeitado without duplicates', async () => {
      await callGuardador({ erro: true, rejeitado: true });

      const calledFilter = (vanzeiroAggregatorService.aggregate as jest.Mock).mock.calls[0][0];
      expect(calledFilter.statuses).toHaveLength(2);
      expect(calledFilter.statuses).toEqual(expect.arrayContaining([StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO]));
    });

    it.each([
      [{ eleicao: true }],
      [{ stucGratuidade: true }],
    ])('rejects %j with 400 instead of ignoring it', async (overrides) => {
      await expect(callGuardador(overrides)).rejects.toMatchObject({ status: 400 });
      expect(vanzeiroAggregatorService.aggregate).not.toHaveBeenCalled();
    });

    it('forwards desativados and pendentes, like the Guardador Movimentacao Financeira', async () => {
      await callGuardador({ desativados: true, pendentes: true });

      const calledFilter = (vanzeiroAggregatorService.aggregate as jest.Mock).mock.calls[0][0];
      expect(calledFilter.desativados).toBe(true);
      expect(calledFilter.statuses).toEqual([StatusPagamento.PENDENTES]);
    });
  });
  it.each([
    [{ stucGratuidade: true, consorcioNome: ['VLT'], pendentes: true }],
    [{ eleicao: true, todosVanzeiros: true, todosConsorcios: true }],
    [{ stucGratuidade: true, eleicao: true, desativados: true }],
  ])('delegates %j to the v1 implementation with every filter', async (overrides) => {
    await callController(overrides);

    expect(relatorioNovoRemessaService.findConsolidado).toHaveBeenCalledWith(expect.objectContaining({ dataInicio, dataFim, ...overrides }));
    expect(stucGratuidadeAggregatorService.aggregate).not.toHaveBeenCalled();
    expect(eleicaoAggregatorService.aggregateByFavorecido).not.toHaveBeenCalled();
  });

  it.each([
    [{ todosVanzeiros: true, consorcioNome: ['STPC'] }, { todosVanzeiros: true, consorcioNome: ['STPC'] }],
    [{ todosVanzeiros: undefined }, undefined],
  ])('unites the favorecido and consorcio views for %j, like the legacy report', async (overrides, uniao) => {
    await callController(overrides);

    expect(consolidadoCombinadoService.aggregate).toHaveBeenCalledWith(expect.any(Object), uniao === undefined ? undefined : expect.objectContaining(uniao));
    expect(vanzeiroAggregatorService.aggregate).not.toHaveBeenCalled();
  });
  it.each([[{ consorcioNome: ['STPC'] }], [{ todosConsorcios: true }]])('keeps only the selected favorecido with %j, inside the consorcio filter', async (consorcio) => {
    await callController({ userIds: [1], ...consorcio });

    expect(vanzeiroAggregatorService.aggregate).toHaveBeenCalledWith(expect.objectContaining({ userIds: [1], ...consorcio }));
    expect(consolidadoCombinadoService.aggregate).not.toHaveBeenCalled();
    expect(consorcioAggregatorService.aggregate).not.toHaveBeenCalled();
  });

  it.each([[{ stucGratuidade: true }], [{ eleicao: true }]])('sends the selected favorecido inside the consorcio to the v1 implementation for %j', async (categoria) => {
    await callController({ userIds: [1], consorcioNome: ['STPC'], ...categoria });

    expect(relatorioNovoRemessaService.findConsolidado).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [1], consorcioNome: ['STPC'], favorecidoNoConsorcio: true }),
    );
  });

  it.each([[{ stucGratuidade: true }], [{ eleicao: true }]])('treats no selection as every consorcio for %j, like the Movimentacao Financeira', async (categoria) => {
    await callController({ todosVanzeiros: undefined, ...categoria });

    expect(relatorioNovoRemessaService.findConsolidado).toHaveBeenCalledWith(
      expect.objectContaining({ todosConsorcios: true, favorecidoNoConsorcio: false }),
    );
  });
});
