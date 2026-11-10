import { GUARDS_METADATA } from '@nestjs/common/constants';
import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StatusPagamento } from '../enum/statusRemessafinancial-movement';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsolidadoV2Controller],
      providers: [
        { provide: VanzeiroAggregatorService, useValue: { aggregate: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
        { provide: ConsorcioAggregatorService, useValue: { aggregate: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
        { provide: EleicaoAggregatorService, useValue: { aggregateByFavorecido: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }), aggregateByConsorcio: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
        { provide: StucGratuidadeAggregatorService, useValue: { aggregate: jest.fn().mockResolvedValue({ count: 0, valor: 0, valorAPagar: 0, data: [] }) } },
      ],
    }).compile();

    controller = module.get(ConsolidadoV2Controller);
    vanzeiroAggregatorService = module.get(VanzeiroAggregatorService);
    consorcioAggregatorService = module.get(ConsorcioAggregatorService);
    eleicaoAggregatorService = module.get(EleicaoAggregatorService);
    stucGratuidadeAggregatorService = module.get(StucGratuidadeAggregatorService);
  });

  const dataInicio = new Date('2098-01-01');
  const dataFim = new Date('2098-01-31');

  async function callController(overrides: Partial<Record<string, any>> = {}) {
    const defaults = {
      userIds: undefined,
      consorcioNome: undefined,
      valorMin: undefined,
      valorMax: undefined,
      pago: undefined,
      aPagar: undefined,
      emProcessamento: undefined,
      todosVanzeiros: undefined,
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

  // AuthGuard('jwt') enforcement itself (a real 401 without a token) is an HTTP-level concern,
  // verified at the e2e seam (T6) - a unit spec that calls the controller method directly
  // bypasses the Nest guard pipeline entirely. Here we assert the guard decorator is present,
  // so the route cannot silently lose its auth protection without this spec catching it.
  it('has AuthGuard(jwt) applied to getConsolidado', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ConsolidadoV2Controller.prototype.getConsolidado);
    expect(guards).toBeDefined();
    expect(guards.length).toBeGreaterThan(0);
  });

  it('rejects with 400 when "desativados" is sent as true (out of scope for this slice)', async () => {
    await expect(callController({ desativados: true })).rejects.toMatchObject({ status: 400 });
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
  it.each([{ consorcioNome: ['STPC'] }, { todosConsorcios: true }])('rejects with 400 when userIds is combined with %j', async (consorcioOverrides) => {
    await expect(callController({ userIds: [7], ...consorcioOverrides })).rejects.toMatchObject({ status: 400 });
    await expect(callController({ userIds: [7], stucGratuidade: true, ...consorcioOverrides })).rejects.toMatchObject({ status: 400 });

    expect(consorcioAggregatorService.aggregate).not.toHaveBeenCalled();
    expect(stucGratuidadeAggregatorService.aggregate).not.toHaveBeenCalled();
  });

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
  describe('eleicao', () => {
    it('calls the eleicao aggregator (by favorecido) when eleicao=true alone', async () => {
      await callController({ eleicao: true, pago: true });

      expect(eleicaoAggregatorService.aggregateByFavorecido).toHaveBeenCalledWith(
        expect.objectContaining({ dataInicio, dataFim, statuses: [StatusPagamento.PAGO] }),
      );
      expect(vanzeiroAggregatorService.aggregate).not.toHaveBeenCalled();
      expect(consorcioAggregatorService.aggregate).not.toHaveBeenCalled();
    });

    it('rejects with 400 when eleicao=true is combined with consorcioNome', async () => {
      await expect(callController({ eleicao: true, consorcioNome: ['CONSORCIO TESTE'] })).rejects.toThrow(HttpException);
    });

    it('selects the consorcio view when eleicao=true is combined with todosConsorcios', async () => {
      await callController({ eleicao: true, todosConsorcios: true });

      expect(eleicaoAggregatorService.aggregateByConsorcio).toHaveBeenCalledWith(expect.objectContaining({ todosConsorcios: true }));
      expect(eleicaoAggregatorService.aggregateByFavorecido).not.toHaveBeenCalled();
    });

    it('rejects with 400 when eleicao=true is combined with userIds', async () => {
      await expect(callController({ eleicao: true, userIds: [1] })).rejects.toThrow(HttpException);
    });
  });

  // STUC tem roteamento proprio; o filtro de consorcio vai para o repositorio.
  it('calls the STUC-Gratuidade aggregator when "stucGratuidade" is true', async () => {
    await callController({ stucGratuidade: true, pago: true });

    expect(stucGratuidadeAggregatorService.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ dataInicio, dataFim, statuses: [StatusPagamento.PAGO] }),
    );
    expect(vanzeiroAggregatorService.aggregate).not.toHaveBeenCalled();
    expect(consorcioAggregatorService.aggregate).not.toHaveBeenCalled();
  });

  it.each([{ consorcioNome: ['CONSORCIO TESTE'] }, { todosConsorcios: true }])(
    'forwards the consórcio filter (%j) to the STUC-Gratuidade aggregator',
    async (consorcioOverrides) => {
      await callController({ stucGratuidade: true, ...consorcioOverrides });

      expect(stucGratuidadeAggregatorService.aggregate).toHaveBeenCalledWith(expect.objectContaining(consorcioOverrides));
      expect(consorcioAggregatorService.aggregate).not.toHaveBeenCalled();
    },
  );

  it('forwards userIds to the STUC-Gratuidade aggregator', async () => {
    await callController({ stucGratuidade: true, userIds: [7] });

    expect(stucGratuidadeAggregatorService.aggregate).toHaveBeenCalledWith(expect.objectContaining({ userIds: [7] }));
  });

  // STUC nao tem fonte de Pendentes: o legado devolveria todos os status nesse caso.
  it('rejects with 400 when "stucGratuidade" is combined with pendentes', async () => {
    await expect(callController({ stucGratuidade: true, pendentes: true })).rejects.toMatchObject({ status: 400 });

    expect(stucGratuidadeAggregatorService.aggregate).not.toHaveBeenCalled();
  });

  it('gives stucGratuidade precedence over eleicao, like the legacy findConsolidado', async () => {
    await callController({ stucGratuidade: true, eleicao: true });

    expect(stucGratuidadeAggregatorService.aggregate).toHaveBeenCalledTimes(1);
    expect(eleicaoAggregatorService.aggregateByFavorecido).not.toHaveBeenCalled();
  });

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

    it('maps erro=true to Estorno + Rejeitado without duplicates', async () => {
      await callGuardador({ erro: true, rejeitado: true });

      const calledFilter = (vanzeiroAggregatorService.aggregate as jest.Mock).mock.calls[0][0];
      expect(calledFilter.statuses).toHaveLength(2);
      expect(calledFilter.statuses).toEqual(expect.arrayContaining([StatusPagamento.ERRO_ESTORNO, StatusPagamento.ERRO_REJEITADO]));
    });

    it.each([
      [{ consorcioNome: ['STPC'] }],
      [{ todosConsorcios: true }],
      [{ eleicao: true }],
      [{ stucGratuidade: true }],
      [{ desativados: true }],
      [{ pendentes: true }],
      [{ userIds: [1] }],
    ])('rejects %j with 400 instead of ignoring it', async (overrides) => {
      await expect(callGuardador(overrides)).rejects.toMatchObject({ status: 400 });
      expect(vanzeiroAggregatorService.aggregate).not.toHaveBeenCalled();
    });
  });
});
