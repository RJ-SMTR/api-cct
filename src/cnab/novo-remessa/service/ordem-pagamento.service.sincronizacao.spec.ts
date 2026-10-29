import { HttpException } from '@nestjs/common';
import { OrdemPagamentoService, MAX_DIAS_SINCRONISMO_MANUAL, CONSORCIOS_E_MODAIS_SINCRONIZADOS } from './ordem-pagamento.service';

describe('OrdemPagamentoService - sincronismo por período', () => {
  // O CustomLogger soma global.__localTzOffset ao timestamp; fora do bootstrap fica indefinido.
  beforeAll(() => {
    (global as any).__localTzOffset = (global as any).__localTzOffset ?? 0;
  });

  const ordemBq = (id: number, extra: Record<string, unknown> = {}) =>
    ({
      id,
      dataOrdem: '2026-10-09',
      dataCaptura: '2026-10-09T12:00:00Z',
      operadoraCpfCnpj: '07280995780',
      consorcio: 'STPL',
      idConsorcio: 'x',
      valorTotalTransacaoLiquido: 10,
      datetimeUltimaAtualizacao: '2026-10-09 10:00:00',
      ...extra,
    }) as any;

  const build = (opcoes: { bq: any[]; antes: number; existentes?: Map<number, any>; resultados?: string[]; usuario?: any }) => {
    const resultados = [...(opcoes.resultados ?? [])];
    const sync = {
      iniciarExecucao: jest.fn().mockResolvedValue(77),
      finalizarExecucao: jest.fn().mockResolvedValue(undefined),
      buscarPorBqIds: jest.fn().mockResolvedValue(opcoes.existentes ?? new Map()),
      vincularUsuario: jest.fn().mockResolvedValue(undefined),
      aplicar: jest.fn().mockImplementation(() => resultados.shift() ?? 'nova'),
      contagemDiariaBanco: jest.fn().mockResolvedValue(new Map()),
      salvarReconciliacao: jest.fn().mockResolvedValue(undefined),
    };
    const ordemPagamentoRepository = {
      findNumeroOrdensPorIntervaloDataCaptura: jest.fn().mockResolvedValue(opcoes.antes),
      sync,
    };
    const bigqueryOrdemPagamentoService = { getFromWeek: jest.fn().mockResolvedValue(opcoes.bq) };
    const usersService = { getOne: jest.fn().mockResolvedValue(opcoes.usuario ?? { id: 519, fullName: 'X', bloqueado: false }) };
    const service = new OrdemPagamentoService(ordemPagamentoRepository as any, {} as any, bigqueryOrdemPagamentoService as any, usersService as any);
    return { service, sync, bigqueryOrdemPagamentoService, usersService };
  };

  const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

  it('rejeita período invertido', async () => {
    const { service, bigqueryOrdemPagamentoService } = build({ bq: [], antes: 0 });
    await expect(service.sincronizarOrdensPorPeriodo(d('2026-10-12'), d('2026-10-09'))).rejects.toBeInstanceOf(HttpException);
    expect(bigqueryOrdemPagamentoService.getFromWeek).not.toHaveBeenCalled();
  });

  it('rejeita período maior que o limite', async () => {
    const { service } = build({ bq: [], antes: 0 });
    await expect(service.sincronizarOrdensPorPeriodo(d('2026-08-01'), d('2026-10-09'))).rejects.toThrow();
    // exatamente no limite é aceito
    const fim = new Date(d('2026-09-01').getTime() + (MAX_DIAS_SINCRONISMO_MANUAL - 1) * 86_400_000);
    await expect(service.sincronizarOrdensPorPeriodo(d('2026-09-01'), fim)).resolves.toBeDefined();
  });

  it('compara mesmo com a contagem igual, registra a execução manual e usa os consórcios do cron', async () => {
    const { service, sync, bigqueryOrdemPagamentoService } = build({ bq: [ordemBq(1), ordemBq(2)], antes: 2 });

    const r = await service.sincronizarOrdensPorPeriodo(d('2026-10-09'), d('2026-10-09'), undefined, 45);

    expect(r.puladoPorContagemIgual).toBe(false);
    expect(r.encontradasNoBigQuery).toBe(2);
    expect(r.execucaoId).toBe(77);
    expect(sync.aplicar).toHaveBeenCalledTimes(2);
    expect(sync.iniciarExecucao).toHaveBeenCalledWith(expect.objectContaining({ origem: 'manual', usuarioId: 45, forcar: true }));
    expect(bigqueryOrdemPagamentoService.getFromWeek).toHaveBeenCalledWith(d('2026-10-09'), d('2026-10-09'), 0, { consorcioName: CONSORCIOS_E_MODAIS_SINCRONIZADOS });
    // a ordem vai para a auditoria identificada pelo id do BigQuery e com o usuário resolvido
    expect(sync.aplicar.mock.calls[0][0]).toMatchObject({ bqId: 1, userId: 519 });
    expect(sync.aplicar.mock.calls[0][2]).toBe(77);
  });

  it('conta nova, idêntica, alterada, contida e mista separadamente', async () => {
    const existentes = new Map([[2, { id: 2 }], [3, { id: 3 }], [4, { id: 4 }], [5, { id: 5 }]]);
    const { service, sync } = build({
      bq: [ordemBq(1), ordemBq(2), ordemBq(3), ordemBq(4), ordemBq(5)],
      antes: 4,
      existentes,
      resultados: ['nova', 'identica', 'alterada', 'contida', 'alterada_e_contida'],
    });

    const r = await service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-09'), ['STPL']);

    expect(r).toMatchObject({ inseridas: 1, identicas: 1, alteradas: 2, contidas: 2, erros: 0 });
    expect(sync.finalizarExecucao).toHaveBeenCalledWith(77, 'concluida', expect.objectContaining({ novas: 1, identicas: 1, alteradas: 2, contidas: 2 }));
  });

  it('liga ao usuário a ordem órfã ainda livre quando o cadastro foi criado depois', async () => {
    const existentes = new Map([
      [1, { id: 10, userId: null, ordemPagamentoAgrupadoId: null, ordemPagamentoAgrupadoGratuidadeId: null }],
      [2, { id: 11, userId: null, ordemPagamentoAgrupadoId: 5, ordemPagamentoAgrupadoGratuidadeId: null }],
      [3, { id: 12, userId: 99, ordemPagamentoAgrupadoId: null, ordemPagamentoAgrupadoGratuidadeId: null }],
    ]);
    const { service, sync, usersService } = build({ bq: [ordemBq(1), ordemBq(2), ordemBq(3)], antes: 3, existentes, resultados: ['alterada', 'identica', 'identica'] });

    await service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-09'), ['STPL']);

    expect(sync.vincularUsuario).toHaveBeenCalledTimes(1);
    expect(sync.vincularUsuario).toHaveBeenCalledWith(10, 519);
    expect(usersService.getOne).toHaveBeenCalledTimes(1);
  });

  it('ignora ordem sem CPF/CNPJ e ordem de usuário bloqueado', async () => {
    const { service, sync } = build({ bq: [ordemBq(1, { operadoraCpfCnpj: null })], antes: 0 });
    expect((await service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-09'), ['STPL'])).ignoradas).toBe(1);
    expect(sync.aplicar).not.toHaveBeenCalled();

    const bloqueado = build({ bq: [ordemBq(1)], antes: 0, usuario: { id: 9, bloqueado: true } });
    expect((await bloqueado.service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-09'), ['STPL'])).ignoradas).toBe(1);
    expect(bloqueado.sync.aplicar).not.toHaveBeenCalled();
  });

  it('erro em uma ordem não derruba a execução e é contado', async () => {
    const { service, sync } = build({ bq: [ordemBq(1), ordemBq(2)], antes: 0 });
    sync.aplicar.mockRejectedValueOnce(new Error('falha')).mockResolvedValueOnce('nova');

    const r = await service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-09'), ['STPL']);

    expect(r).toMatchObject({ erros: 1, inseridas: 1 });
    expect(sync.finalizarExecucao).toHaveBeenCalledWith(77, 'concluida', expect.anything());
  });

  it('falha geral finaliza a execução com status erro e repassa o erro', async () => {
    const { service, sync } = build({ bq: [ordemBq(1)], antes: 0 });
    sync.buscarPorBqIds.mockRejectedValueOnce(new Error('banco fora'));

    await expect(service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-09'), ['STPL'])).rejects.toThrow('banco fora');
    expect(sync.finalizarExecucao).toHaveBeenCalledWith(77, 'erro', expect.anything(), 'banco fora');
  });

  it('falha ao gravar a reconciliação não derruba o sincronismo (o agrupamento do cron continua) e a execução fica concluída', async () => {
    const { service, sync } = build({ bq: [ordemBq(1)], antes: 0 });
    sync.salvarReconciliacao.mockRejectedValueOnce(new Error('operator is not unique: unknown - unknown'));

    const r = await service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-09'), ['STPL']);

    expect(r).toMatchObject({ inseridas: 1, erros: 0 });
    expect(sync.finalizarExecucao).toHaveBeenCalledWith(77, 'concluida', expect.objectContaining({ novas: 1 }));
  });

  it('o cron registra a execução como origem cron e grava a reconciliação diária', async () => {
    const { service, sync } = build({ bq: [ordemBq(1)], antes: 1 });

    await service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-09'), ['STPL']);

    expect(sync.iniciarExecucao).toHaveBeenCalledWith(expect.objectContaining({ origem: 'cron', forcar: false }));
    expect(sync.salvarReconciliacao).toHaveBeenCalledWith([expect.objectContaining({ data: '2026-10-09', bqQtd: 1, bqValor: 10, bdQtd: 0 })], 77);
  });
});
