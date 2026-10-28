import { RemessaService } from './remessa.service';

/** Desconto do pagamento indevido no valor da remessa: teto de R$ por indevido (padrão 100), nunca mais que o saldo nem que o pagamento. */
describe('RemessaService.debitarPagamentoIndevido', () => {
  let service: RemessaService;
  let salvos: any[];

  const indevido = (saldoDevedor: number) => ({ saldoDevedor, dataReferencia: null }) as any;

  beforeEach(() => {
    salvos = [];
    const pagamentoIndevidoService = { save: jest.fn(async (p: any) => salvos.push({ ...p })) };
    service = new RemessaService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      pagamentoIndevidoService as any,
    );
  });

  it('padrão R$ 100: saldo maior que o teto desconta 100 do pagamento e o saldo cai 100', async () => {
    const p = indevido(639.8);
    await expect(service.debitarPagamentoIndevido(p, 238)).resolves.toBe(138);
    expect(p.saldoDevedor).toBe(539.8);
    expect(salvos).toHaveLength(1);
  });

  it('pagamento menor que o teto: desconta o pagamento inteiro e paga 0', async () => {
    const p = indevido(300);
    await expect(service.debitarPagamentoIndevido(p, 60)).resolves.toBe(0);
    expect(p.saldoDevedor).toBe(240);
  });

  it('saldo menor que o teto: desconta só o saldo, quita e paga o resto', async () => {
    const p = indevido(40);
    await expect(service.debitarPagamentoIndevido(p, 120)).resolves.toBe(80);
    expect(p.saldoDevedor).toBe(0);
  });

  it('valor máximo informado: R$ 250 por indevido', async () => {
    const p = indevido(600);
    await expect(service.debitarPagamentoIndevido(p, 400, 250)).resolves.toBe(150);
    expect(p.saldoDevedor).toBe(350);
  });

  it('valor máximo 0 não desconta nem grava nada', async () => {
    const p = indevido(300);
    await expect(service.debitarPagamentoIndevido(p, 100, 0)).resolves.toBe(100);
    expect(p.saldoDevedor).toBe(300);
    expect(salvos).toHaveLength(0);
  });

  it('arredonda em centavos', async () => {
    const p = indevido(100.55);
    await expect(service.debitarPagamentoIndevido(p, 33.33, 20.1)).resolves.toBe(13.23);
    expect(p.saldoDevedor).toBe(80.45);
  });
});
