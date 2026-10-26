import { PagamentosIndevidosGuardadoresService } from './pagamentos-indevidos-guardadores.service';

describe('PagamentosIndevidosGuardadoresService.porUsuario', () => {
  const totaisComSaldo = { quantidade: 1, devendo: 1, valorIndevido: '877.80', valorDebitado: '238.00', saldoDevedor: '639.80' };
  const totaisSemSaldo = { quantidade: 1, devendo: 0, valorIndevido: '56.00', valorDebitado: '56.00', saldoDevedor: '0.00' };
  const lancamentos = [{ data: '2026-10-16', valorDevido: '238.00', valorPago: '0.00', diferenca: '-238.00', statusRemessa: 3 }];
  const ordens = [
    { dia: '2026-07-28', valor: '114.80', pagoEm: '2026-08-12' },
    { dia: '2026-07-28', valor: '114.80', pagoEm: '2026-09-03' },
    { dia: '2026-07-28', valor: '114.80', pagoEm: '2026-09-23' },
    { dia: '2026-07-31', valor: '177.80', pagoEm: '2026-08-12' },
    { dia: '2026-07-31', valor: '177.80', pagoEm: '2026-09-03' },
    { dia: '2026-10-20', valor: '18.20', pagoEm: '2026-10-21' },
  ];

  const build = (...respostas: unknown[][]) => {
    const query = jest.fn();
    respostas.forEach((r) => query.mockResolvedValueOnce(r));
    return { service: new PagamentosIndevidosGuardadoresService({ query } as any), query };
  };

  it('devolve os totais, os pagamentos com abatimento e as datas da duplicidade', async () => {
    const { service } = build([totaisComSaldo], lancamentos, ordens);

    await expect(service.porUsuario(2456)).resolves.toEqual({
      totais: totaisComSaldo,
      lancamentos,
      datasDuplicidade: ['2026-09-03', '2026-09-23'],
    });
  });

  it('com o débito quitado os pagamentos abatidos continuam saindo (a tela marca o abatimento por duplicidade)', async () => {
    const { service } = build([totaisSemSaldo], lancamentos, ordens);

    await expect(service.porUsuario(2456)).resolves.toEqual({
      totais: totaisSemSaldo,
      lancamentos,
      datasDuplicidade: ['2026-09-03', '2026-09-23'],
    });
  });

  it('sem nenhum pagamento indevido não busca mais nada', async () => {
    const semIndevido = { quantidade: 0, devendo: 0, valorIndevido: '0.00', valorDebitado: '0.00', saldoDevedor: '0.00' };
    const { service, query } = build([semIndevido]);

    await expect(service.porUsuario(2456)).resolves.toEqual({ totais: semIndevido, lancamentos: [], datasDuplicidade: [] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('filtra pelo id do usuário como parâmetro (nunca concatenado) em todas as consultas', async () => {
    const { service, query } = build([totaisComSaldo], lancamentos, ordens);

    await service.porUsuario(2456);

    expect(query).toHaveBeenCalledTimes(3);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain('$1');
      expect(sql).not.toContain('2456');
      expect(params).toEqual([2456]);
    }
  });

  it('só considera guardadores (permitCode de até 4 caracteres)', async () => {
    const { service, query } = build([totaisSemSaldo], lancamentos, ordens);

    await service.porUsuario(2456);

    expect(query.mock.calls[0][0]).toContain('length(u."permitCode") <= 4');
  });
});

describe('PagamentosIndevidosGuardadoresService.datasDeDuplicidade', () => {
  const datas = PagamentosIndevidosGuardadoresService.datasDeDuplicidade;

  it('a primeira vez que a ordem foi paga é a devida; as seguintes são a duplicidade', () => {
    expect(
      datas([
        { dia: '2026-10-09', valor: '50.00', pagoEm: '2026-10-13' },
        { dia: '2026-10-09', valor: '50.00', pagoEm: '2026-10-10' },
      ]),
    ).toEqual(['2026-10-13']);
  });

  it('ordem sem pagamento não conta e ordens diferentes não se misturam', () => {
    expect(
      datas([
        { dia: '2026-10-09', valor: '50.00', pagoEm: null },
        { dia: '2026-10-09', valor: '50.00', pagoEm: '2026-10-10' },
        { dia: '2026-10-09', valor: '60.00', pagoEm: '2026-10-11' },
      ]),
    ).toEqual([]);
  });

  it('junta e ordena as datas de todas as ordens duplicadas, sem repetir', () => {
    expect(
      datas([
        { dia: '2026-07-28', valor: '10.00', pagoEm: '2026-08-12' },
        { dia: '2026-07-28', valor: '10.00', pagoEm: '2026-09-23' },
        { dia: '2026-07-31', valor: '20.00', pagoEm: '2026-08-12' },
        { dia: '2026-07-31', valor: '20.00', pagoEm: '2026-09-23' },
        { dia: '2026-07-31', valor: '20.00', pagoEm: '2026-09-03' },
      ]),
    ).toEqual(['2026-09-03', '2026-09-23']);
  });
});
