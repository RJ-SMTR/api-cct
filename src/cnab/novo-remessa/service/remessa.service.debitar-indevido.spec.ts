import { RemessaService } from './remessa.service';

/** Desconto do pagamento indevido no valor da remessa: teto de X% do saldo devedor, nunca mais que o pagamento. */
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

  it('100% (padrão): saldo maior que o pagamento -> paga 0 e o saldo cai pelo valor do pagamento', async () => {
    const p = indevido(300);
    await expect(service.debitarPagamentoIndevido(p, 120)).resolves.toBe(0);
    expect(p.saldoDevedor).toBe(180);
    expect(salvos).toHaveLength(1);
  });

  it('100%: saldo menor que o pagamento -> quita o saldo e paga a diferença', async () => {
    const p = indevido(50);
    await expect(service.debitarPagamentoIndevido(p, 120)).resolves.toBe(70);
    expect(p.saldoDevedor).toBe(0);
  });

  it('100%: saldo igual ao pagamento -> quita e paga 0', async () => {
    const p = indevido(120);
    await expect(service.debitarPagamentoIndevido(p, 120)).resolves.toBe(0);
    expect(p.saldoDevedor).toBe(0);
  });

  it('50% do saldo: desconta no máximo metade do saldo devedor e paga o resto', async () => {
    const p = indevido(300);
    await expect(service.debitarPagamentoIndevido(p, 200, 50)).resolves.toBe(50); // teto 150 -> paga 200-150
    expect(p.saldoDevedor).toBe(150);
  });

  it('percentual alto não desconta mais que o pagamento', async () => {
    const p = indevido(300);
    await expect(service.debitarPagamentoIndevido(p, 100, 80)).resolves.toBe(0); // teto 240, mas o pagamento é 100
    expect(p.saldoDevedor).toBe(200);
  });

  it('percentual 0 não desconta nem grava nada', async () => {
    const p = indevido(300);
    await expect(service.debitarPagamentoIndevido(p, 100, 0)).resolves.toBe(100);
    expect(p.saldoDevedor).toBe(300);
    expect(salvos).toHaveLength(0);
  });

  it('arredonda em centavos', async () => {
    const p = indevido(100.55);
    await expect(service.debitarPagamentoIndevido(p, 33.33, 33.33)).resolves.toBe(0); // teto 33.51 > 33.33
    expect(p.saldoDevedor).toBe(67.22);
  });
});
