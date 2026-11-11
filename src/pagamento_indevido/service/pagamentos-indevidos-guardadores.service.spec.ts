import { PagamentosIndevidosGuardadoresService } from './pagamentos-indevidos-guardadores.service';

describe('PagamentosIndevidosGuardadoresService.porUsuario', () => {
  const totaisComSaldo = { quantidade: 1, devendo: 1, valorIndevido: '877.80', valorDebitado: '238.00', saldoDevedor: '639.80' };
  const totaisSemSaldo = { quantidade: 1, devendo: 0, valorIndevido: '56.00', valorDebitado: '56.00', saldoDevedor: '0.00' };
  const lancamentos = [{ data: '2026-10-16', valorDevido: '238.00', valorPago: '0.00', diferenca: '-238.00', statusRemessa: 3 }];
  const ordensSemUsuario = [
    { dia: '2026-07-28', valor: '114.80', pagamentos: ['2026-08-12'] },
    { dia: '2026-07-28', valor: '114.80', pagamentos: ['2026-09-03'] },
    { dia: '2026-07-28', valor: '114.80', pagamentos: ['2026-09-23'] },
    { dia: '2026-07-31', valor: '177.80', pagamentos: ['2026-08-12'] },
    { dia: '2026-07-31', valor: '177.80', pagamentos: ['2026-09-03'] },
    { dia: '2026-10-20', valor: '18.20', pagamentos: ['2026-10-21'] },
  ];
  // A consulta de ordens traz o usuário de cada linha (ela serve tanto a tela do guardador quanto a lista).
  const ordens = ordensSemUsuario.map((o) => ({ userId: 2456, ...o }));

  const duplicidades = [
    { dataOrdem: '2026-07-28', valor: '114.80', pagoEm: '2026-08-12', repetidoEm: ['2026-09-03', '2026-09-23'] },
    { dataOrdem: '2026-07-31', valor: '177.80', pagoEm: '2026-08-12', repetidoEm: ['2026-09-03'] },
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
      duplicidades,
    });
  });

  it('com o débito quitado os pagamentos abatidos continuam saindo (a tela marca o abatimento por duplicidade)', async () => {
    const { service } = build([totaisSemSaldo], lancamentos, ordens);

    await expect(service.porUsuario(2456)).resolves.toEqual({
      totais: totaisSemSaldo,
      lancamentos,
      datasDuplicidade: ['2026-09-03', '2026-09-23'],
      duplicidades,
    });
  });

  it('sem nenhum pagamento indevido não busca mais nada', async () => {
    const semIndevido = { quantidade: 0, devendo: 0, valorIndevido: '0.00', valorDebitado: '0.00', saldoDevedor: '0.00' };
    const { service, query } = build([semIndevido]);

    await expect(service.porUsuario(2456)).resolves.toEqual({ totais: semIndevido, lancamentos: [], datasDuplicidade: [], duplicidades: [] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('filtra pelo id do usuário como parâmetro (nunca concatenado) em todas as consultas', async () => {
    const { service, query } = build([totaisComSaldo], lancamentos, ordens);

    await service.porUsuario(2456);

    expect(query).toHaveBeenCalledTimes(3);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain('$1');
      expect(sql).not.toContain('2456');
      expect([[2456], [[2456]]]).toContainEqual(params);
    }
  });

  it('só considera guardadores (permitCode de até 4 caracteres)', async () => {
    const { service, query } = build([totaisSemSaldo], lancamentos, ordens);

    await service.porUsuario(2456);

    expect(query.mock.calls[0][0]).toContain('length(u."permitCode") <= 4');
  });
});

describe('PagamentosIndevidosGuardadoresService.duplicidadesDeOrdens / datasDeDuplicidade', () => {
  const duplicidades = PagamentosIndevidosGuardadoresService.duplicidadesDeOrdens;
  const datas = PagamentosIndevidosGuardadoresService.datasDeDuplicidade;

  it('a primeira vez que a ordem foi paga é a devida; as seguintes são a duplicidade', () => {
    const ordens = [
      { dia: '2026-10-09', valor: '50.00', pagamentos: ['2026-10-13'] },
      { dia: '2026-10-09', valor: '50.00', pagamentos: ['2026-10-10'] },
    ];
    expect(duplicidades(ordens)).toEqual([{ dataOrdem: '2026-10-09', valor: '50.00', pagoEm: '2026-10-10', repetidoEm: ['2026-10-13'] }]);
    expect(datas(ordens)).toEqual(['2026-10-13']);
  });

  it('conta todos os pagamentos: a ordem paga em 23/09 e de novo em 01/10 repete as duas datas (caso do guardador 2550)', () => {
    const ordens = [
      { dia: '2026-08-14', valor: '204.40', pagamentos: ['2026-09-23', '2026-10-01'] },
      { dia: '2026-08-14', valor: '204.40', pagamentos: ['2026-09-03'] },
    ];
    expect(duplicidades(ordens)).toEqual([
      { dataOrdem: '2026-08-14', valor: '204.40', pagoEm: '2026-09-03', repetidoEm: ['2026-09-23', '2026-10-01'] },
    ]);
    expect(datas(ordens)).toEqual(['2026-09-23', '2026-10-01']);
  });

  it('uma ordem sozinha paga duas vezes também é duplicidade', () => {
    expect(duplicidades([{ dia: '2026-09-15', valor: '361.20', pagamentos: ['2026-09-23', '2026-10-01'] }])).toEqual([
      { dataOrdem: '2026-09-15', valor: '361.20', pagoEm: '2026-09-23', repetidoEm: ['2026-10-01'] },
    ]);
  });

  it('ordem sem pagamento, paga uma vez ou de valor diferente não é duplicidade', () => {
    const ordens = [
      { dia: '2026-10-09', valor: '50.00', pagamentos: [] },
      { dia: '2026-10-09', valor: '50.00', pagamentos: ['2026-10-10'] },
      { dia: '2026-10-09', valor: '60.00', pagamentos: ['2026-10-11'] },
    ];
    expect(duplicidades(ordens)).toEqual([]);
    expect(datas(ordens)).toEqual([]);
  });

  it('junta e ordena as datas de todas as ordens duplicadas, sem repetir', () => {
    expect(
      datas([
        { dia: '2026-07-28', valor: '10.00', pagamentos: ['2026-08-12'] },
        { dia: '2026-07-28', valor: '10.00', pagamentos: ['2026-09-23'] },
        { dia: '2026-07-31', valor: '20.00', pagamentos: ['2026-08-12'] },
        { dia: '2026-07-31', valor: '20.00', pagamentos: ['2026-09-23'] },
        { dia: '2026-07-31', valor: '20.00', pagamentos: ['2026-09-03'] },
      ]),
    ).toEqual(['2026-09-03', '2026-09-23']);
  });
});

describe('PagamentosIndevidosGuardadoresService.listar: ordens duplicadas', () => {
  it('cada linha traz os dias das ordens pagas em duplicidade do guardador', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ quantidade: 2 }]) // totais
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([
        { id: 1, userId: 2550, guardador: 'A' },
        { id: 2, userId: 10, guardador: 'B' },
        { id: 3, userId: null, guardador: 'C' },
      ])
      .mockResolvedValueOnce([
        { userId: 2550, dia: '2026-08-14', valor: '204.40', pagamentos: ['2026-09-03'] },
        { userId: 2550, dia: '2026-08-14', valor: '204.40', pagamentos: ['2026-10-01'] },
        { userId: 2550, dia: '2026-08-18', valor: '119.00', pagamentos: ['2026-09-03'] },
        { userId: 2550, dia: '2026-08-18', valor: '119.00', pagamentos: ['2026-10-01'] },
        { userId: 2550, dia: '2026-09-15', valor: '361.20', pagamentos: ['2026-10-01'] },
        { userId: 10, dia: '2026-09-04', valor: '10.00', pagamentos: ['2026-09-04'] },
      ]);
    const service = new PagamentosIndevidosGuardadoresService({ query } as any);

    const { itens } = await service.listar({});

    expect(itens.map((i) => i.ordensDuplicadas)).toEqual([['2026-08-14', '2026-08-18'], [], []]);
    expect(query.mock.calls[3][1]).toEqual([[2550, 10]]);
  });
});
