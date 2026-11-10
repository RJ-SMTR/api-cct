import { AuditoriaController } from './auditoria.controller';

describe('AuditoriaController.sincronizar', () => {
  const build = () => {
    const ordemPagamentoService = { sincronizarOrdensPorPeriodo: jest.fn().mockResolvedValue({ execucaoId: 7 }) };
    const controller = new AuditoriaController({} as any, {} as any, ordemPagamentoService as any);
    return { controller, ordemPagamentoService };
  };

  it('sincroniza o período informado (datas em UTC) e registra o usuário que pediu', async () => {
    const { controller, ordemPagamentoService } = build();

    await expect(controller.sincronizar({ dataInicio: '2026-11-06', dataFim: '2026-11-06' }, { user: { id: 45 } })).resolves.toEqual({ execucaoId: 7 });

    expect(ordemPagamentoService.sincronizarOrdensPorPeriodo).toHaveBeenCalledWith(
      new Date('2026-11-06T00:00:00.000Z'),
      new Date('2026-11-06T00:00:00.000Z'),
      undefined,
      45,
    );
  });

  it('repassa os consórcios escolhidos', async () => {
    const { controller, ordemPagamentoService } = build();

    await controller.sincronizar({ dataInicio: '2026-11-05', dataFim: '2026-11-06', consorcios: ['STPL'] }, { user: { id: 45 } });

    expect(ordemPagamentoService.sincronizarOrdensPorPeriodo.mock.calls[0][2]).toEqual(['STPL']);
  });
});
