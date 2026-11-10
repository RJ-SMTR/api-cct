import { RemessaService } from './remessa.service';

/**
 * O saldo do indevido é lido antes do laço que gera os pagamentos; ordens do mesmo favorecido no mesmo preparo devem dividir o
 * saldo (e um DetalheA refeito não pode debitar o indevido de novo), senão o desconto passa do saldo devedor.
 */
describe('RemessaService - indevido no preparo dos pagamentos', () => {
  const build = (extra: Record<string, any> = {}) => {
    const salvos: any[] = [];
    const pagamentoIndevidoService = {
      findByNome: jest.fn(async (nome: string) => [{ nome, saldoDevedor: 150, dataReferencia: null }]),
      save: jest.fn(async (p: any) => { salvos.push({ ...p }); }),
    };
    const detalheAService = {
      existsDetalheA: jest.fn().mockResolvedValue([]),
      getNextNumeroDocumento: jest.fn().mockResolvedValue(1),
      save: jest.fn(async (d: any) => ({ ...d, id: 1 })),
      ...extra,
    };
    const service = new RemessaService(
      { getHistoricoUnico: jest.fn() } as any, {} as any, {} as any, detalheAService as any, { findDetalheBDetalheAId: jest.fn().mockResolvedValue(null), save: jest.fn(async (d: any) => d) } as any,
      {} as any, {} as any, {} as any, {} as any, pagamentoIndevidoService as any,
    );
    return { service, pagamentoIndevidoService, detalheAService, salvos };
  };

  it('lê o indevido uma vez por favorecido e devolve o mesmo objeto para as demais ordens', async () => {
    const { service, pagamentoIndevidoService } = build();
    const cache = new Map<string, Promise<any>>();

    const a = await (service as any).indevidoCompartilhado(cache, 'Fulano');
    const b = await (service as any).indevidoCompartilhado(cache, 'Fulano');
    const outro = await (service as any).indevidoCompartilhado(cache, 'Ciclano');

    expect(b).toBe(a);
    expect(outro).not.toBe(a);
    expect(pagamentoIndevidoService.findByNome).toHaveBeenCalledTimes(2);
  });

  it('duas ordens do mesmo favorecido não descontam mais que o saldo devedor (150 = 100 + 50)', async () => {
    const { service, pagamentoIndevidoService } = build();
    const cache = new Map<string, Promise<any>>();
    const indevido = (await (service as any).indevidoCompartilhado(cache, 'Fulano'))[0];

    const primeira = await service.debitarPagamentoIndevido(indevido, 200);
    const segunda = await service.debitarPagamentoIndevido((await (service as any).indevidoCompartilhado(cache, 'Fulano'))[0], 200);

    expect(primeira).toBe(100);
    expect(segunda).toBe(150);
    expect(indevido.saldoDevedor).toBe(0);
    expect(pagamentoIndevidoService.save).toHaveBeenCalledTimes(2);
  });

  it('DetalheA já gerado com o desconto ligado: mantém o valor gravado e não debita de novo', async () => {
    const { service, pagamentoIndevidoService, detalheAService } = build({ existsDetalheA: jest.fn().mockResolvedValue([{ id: 9, valorLancamento: 100 }]) });
    const indevido = { saldoDevedor: 50, dataReferencia: null } as any;
    const ordem = { id: 1, valorTotal: 200, dataPagamento: new Date(), ordensPagamentoAgrupadoHistorico: [{ id: 5 }] } as any;

    await (service as any).gerarDetalheAB({ id: 1, formaLancamento: '01' }, ordem, 1, indevido, false, { value: 10 });

    expect(pagamentoIndevidoService.save).not.toHaveBeenCalled();
    expect(indevido.saldoDevedor).toBe(50);
    expect(detalheAService.save.mock.calls[0][0].valorLancamento).toBe(100);
  });
});
