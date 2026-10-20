import { HttpException } from '@nestjs/common';
import { DashboardPagamentosService, MAX_DIAS_DASHBOARD, MAX_LINHAS_EXPORTACAO, validarPeriodo } from './dashboard-pagamentos.service';

describe('DashboardPagamentosService', () => {
  const build = () => {
    const repo = {
      resumo: jest.fn().mockResolvedValue([{ conta: 'rotativo', grupo: 'Guardador', situacao: 'pago', motivo: 'EFETIVADO', qtd: 2, valor: '10.50' }]),
      detalhe: jest.fn().mockResolvedValue({
        total: 1,
        valorTotal: 99.9,
        itens: [{ detalheAId: 1, agrupadoId: 2, valor: '99.90', motivo: 'ANHO', situacao: 'naoPago', grupo: 'STPL' }],
      }),
    };
    return { service: new DashboardPagamentosService(repo as any), repo };
  };

  describe('validarPeriodo', () => {
    it('aceita um período válido', () => {
      expect(() => validarPeriodo({ dataInicio: '2026-09-01', dataFim: '2026-09-30' })).not.toThrow();
    });

    it.each([
      ['datas inexistentes', { dataInicio: '2026-02-30', dataFim: '2026-03-01' }],
      ['início depois do fim', { dataInicio: '2026-10-10', dataFim: '2026-10-01' }],
      ['período acima do limite', { dataInicio: '2024-01-01', dataFim: '2026-10-01' }],
    ])('recusa %s', (_nome, periodo) => {
      expect(() => validarPeriodo(periodo)).toThrow(HttpException);
    });

    it('aceita exatamente o limite de dias', () => {
      const fim = new Date(Date.UTC(2026, 0, 1) + (MAX_DIAS_DASHBOARD - 1) * 86_400_000).toISOString().slice(0, 10);
      expect(() => validarPeriodo({ dataInicio: '2026-01-01', dataFim: fim })).not.toThrow();
    });
  });

  it('resumo: valida o período antes de consultar e devolve as três contas', async () => {
    const { service, repo } = build();

    await expect(service.resumo({ dataInicio: '2026-10-10', dataFim: '2026-10-01' })).rejects.toBeInstanceOf(HttpException);
    expect(repo.resumo).not.toHaveBeenCalled();

    const r = await service.resumo({ dataInicio: '2026-09-01', dataFim: '2026-09-30' });
    expect(r.contas.map((c) => c.conta)).toEqual(['bilhetagem', 'rotativo', 'cett']);
    expect(r.contas[1].pago).toEqual({ qtd: 2, valor: 10.5 });
    expect(r.periodo).toEqual({ dataInicio: '2026-09-01', dataFim: '2026-09-30' });
  });

  it('detalhe: usa página 1 e tamanho 50 por padrão, converte o valor e descreve o motivo', async () => {
    const { service, repo } = build();

    const r = await service.detalhe({ dataInicio: '2026-09-01', dataFim: '2026-09-30', conta: 'bilhetagem', grupo: 'STPL', situacao: 'naoPago' });

    expect(repo.detalhe).toHaveBeenCalledWith(expect.objectContaining({ conta: 'bilhetagem', grupo: 'STPL', situacao: 'naoPago', page: 1, pageSize: 50 }));
    expect(r).toMatchObject({ total: 1, valorTotal: 99.9, page: 1, pageSize: 50 });
    expect(r.itens[0]).toMatchObject({ valor: 99.9, motivoDescricao: 'Conta digital' });
  });

  it('detalhe: repassa a busca por favorecido sem espaços nas pontas', async () => {
    const { service, repo } = build();

    await service.detalhe({ dataInicio: '2026-09-01', dataFim: '2026-09-30', conta: 'rotativo', busca: '  paulo cesar  ' });

    expect(repo.detalhe).toHaveBeenCalledWith(expect.objectContaining({ busca: 'paulo cesar' }));
  });

  it('detalhe: busca em branco é ignorada e busca de 1 caractere é recusada', async () => {
    const { service, repo } = build();

    await service.detalhe({ dataInicio: '2026-09-01', dataFim: '2026-09-30', conta: 'rotativo', busca: '   ' });
    expect(repo.detalhe).toHaveBeenCalledWith(expect.objectContaining({ busca: undefined }));

    repo.detalhe.mockClear();
    await expect(service.detalhe({ dataInicio: '2026-09-01', dataFim: '2026-09-30', conta: 'rotativo', busca: 'a' })).rejects.toBeInstanceOf(HttpException);
    expect(repo.detalhe).not.toHaveBeenCalled();
  });
  describe('exportar', () => {
    const periodo = { dataInicio: '2026-10-20', dataFim: '2026-10-20', conta: 'cett' as const };
    const linhaBanco = { detalheAId: 1, nome: 'ABDON ALVIM DE QUEIROZ', cpf: '38624400791', dataOrdem: '2026-10-16', valorOrdem: '80', valorLancamento: '340.00' };

    it('valida o período e a busca antes de consultar', async () => {
      const { service, repo } = build();
      (repo as any).exportar = jest.fn();
      await expect(service.exportar({ ...periodo, dataFim: '2026-10-01' })).rejects.toBeInstanceOf(HttpException);
      await expect(service.exportar({ ...periodo, busca: 'a' })).rejects.toBeInstanceOf(HttpException);
      expect((repo as any).exportar).not.toHaveBeenCalled();
    });

    it('converte os valores para número e repassa o filtro sem a paginação', async () => {
      const { service, repo } = build();
      (repo as any).exportar = jest.fn().mockResolvedValue([linhaBanco, { ...linhaBanco, dataOrdem: null, valorOrdem: null }]);

      const r = await service.exportar({ ...periodo, situacao: 'pago', busca: '  abdon ', page: 3, pageSize: 10 } as any);

      expect((repo as any).exportar).toHaveBeenCalledWith(expect.objectContaining({ conta: 'cett', situacao: 'pago', busca: 'abdon' }), MAX_LINHAS_EXPORTACAO);
      expect((repo as any).exportar.mock.calls[0][0]).not.toHaveProperty('page');
      expect(r.total).toBe(2);
      expect(r.linhas[0]).toEqual({ detalheAId: 1, nome: 'ABDON ALVIM DE QUEIROZ', cpf: '38624400791', dataOrdem: '2026-10-16', valorOrdem: 80, valorLancamento: 340 });
      expect(r.linhas[1]).toMatchObject({ dataOrdem: null, valorOrdem: null });
    });

    it('recusa exportação acima do limite de linhas', async () => {
      const { service, repo } = build();
      (repo as any).exportar = jest.fn().mockResolvedValue(new Array(MAX_LINHAS_EXPORTACAO + 1).fill(linhaBanco));
      await expect(service.exportar(periodo)).rejects.toBeInstanceOf(HttpException);
    });
  });
});
