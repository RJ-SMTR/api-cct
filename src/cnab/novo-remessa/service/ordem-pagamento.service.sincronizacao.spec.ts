import { HttpException } from '@nestjs/common';
import { OrdemPagamentoService, MAX_DIAS_SINCRONISMO_MANUAL, CONSORCIOS_E_MODAIS_SINCRONIZADOS } from './ordem-pagamento.service';

describe('OrdemPagamentoService - sincronismo por período', () => {
  // O CustomLogger soma global.__localTzOffset ao timestamp; fora do bootstrap fica indefinido.
  beforeAll(() => {
    (global as any).__localTzOffset = (global as any).__localTzOffset ?? 0;
  });

  const ordemBq = (id: number) =>
    ({ id, dataOrdem: '2026-10-09', operadoraCpfCnpj: '07280995780', consorcio: 'STPL', idConsorcio: 'x', valorTotalTransacaoLiquido: 10, datetimeUltimaAtualizacao: '2026-10-09 10:00:00' } as any);

  const build = (opcoes: { bq: any[]; antes: number; depois?: number }) => {
    const ordemPagamentoRepository = {
      findNumeroOrdensPorIntervaloDataCaptura: jest.fn().mockResolvedValueOnce(opcoes.antes).mockResolvedValue(opcoes.depois ?? opcoes.antes),
      save: jest.fn().mockResolvedValue({}),
    };
    const bigqueryOrdemPagamentoService = { getFromWeek: jest.fn().mockResolvedValue(opcoes.bq) };
    const usersService = { getOne: jest.fn().mockResolvedValue({ id: 519, fullName: 'X', bloqueado: false }) };
    const service = new OrdemPagamentoService(ordemPagamentoRepository as any, {} as any, bigqueryOrdemPagamentoService as any, usersService as any);
    return { service, ordemPagamentoRepository, bigqueryOrdemPagamentoService };
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

  it('força a busca mesmo quando a contagem local é igual à do BigQuery e usa os consórcios do cron', async () => {
    const { service, ordemPagamentoRepository, bigqueryOrdemPagamentoService } = build({ bq: [ordemBq(1), ordemBq(2)], antes: 2, depois: 2 });

    const r = await service.sincronizarOrdensPorPeriodo(d('2026-10-09'), d('2026-10-09'));

    expect(r.puladoPorContagemIgual).toBe(false);
    expect(r.encontradasNoBigQuery).toBe(2);
    expect(ordemPagamentoRepository.save).toHaveBeenCalledTimes(2);
    expect(bigqueryOrdemPagamentoService.getFromWeek).toHaveBeenCalledWith(d('2026-10-09'), d('2026-10-09'), 0, { consorcioName: CONSORCIOS_E_MODAIS_SINCRONIZADOS });
    // a ordem vai para o repositório identificada pelo id do BigQuery
    expect(ordemPagamentoRepository.save.mock.calls[0][0]).toMatchObject({ bqId: 1, userId: 519 });
  });

  it('informa quantas ordens foram inseridas', async () => {
    const { service } = build({ bq: [ordemBq(1), ordemBq(2), ordemBq(3)], antes: 1, depois: 3 });
    const r = await service.sincronizarOrdensPorPeriodo(d('2026-10-09'), d('2026-10-09'));
    expect(r.inseridas).toBe(2);
  });

  it('o sincronismo normal (cron) continua pulando quando a contagem é igual', async () => {
    const { service, ordemPagamentoRepository } = build({ bq: [ordemBq(1)], antes: 1 });

    const r = await service.sincronizarOrdensPagamento(d('2026-10-09'), d('2026-10-12'), ['STPL']);

    expect(r.puladoPorContagemIgual).toBe(true);
    expect(ordemPagamentoRepository.save).not.toHaveBeenCalled();
  });
});
