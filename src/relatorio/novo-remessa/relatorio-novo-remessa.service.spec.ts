import { RelatorioNovoRemessaService } from './relatorio-novo-remessa.service';

describe('RelatorioNovoRemessaService.findConsolidadoGuardador', () => {
  let service: RelatorioNovoRemessaService;
  let guardadorConsolidadoRepository: { findConsolidado: jest.Mock };

  const baseArgs = {
    dataInicio: new Date('2026-09-01'),
    dataFim: new Date('2026-09-30'),
  };

  beforeEach(() => {
    guardadorConsolidadoRepository = {
      findConsolidado: jest.fn().mockResolvedValue([{ nome: 'GUARDADOR', valor: 10 }]),
    };
    service = new RelatorioNovoRemessaService(
      {} as any,
      {} as any,
      {} as any,
      guardadorConsolidadoRepository as any,
      {} as any,
    );
  });

  const blockStatuses = (result: { status: string }[]) => result.map((block) => block.status);

  it('keeps returning every block when no status filter is selected', async () => {
    const result = await service.findConsolidadoGuardador(baseArgs);

    expect(blockStatuses(result)).toEqual(['todos', 'pago', 'erros', 'aPagar']);
  });

  it('returns only the pago block when only pago is selected', async () => {
    const result = await service.findConsolidadoGuardador({ ...baseArgs, pago: true });

    expect(blockStatuses(result)).toEqual(['pago']);
  });

  describe('pendenciaPaga', () => {
    it('returns only the pendenciaPaga block, not pago nor aPagar', async () => {
      const result = await service.findConsolidadoGuardador({ ...baseArgs, pendenciaPaga: true });

      expect(blockStatuses(result)).toEqual(['pendenciaPaga']);
      expect(guardadorConsolidadoRepository.findConsolidado).toHaveBeenCalledTimes(1);
    });

    it('queries the repository for pendenciaPaga only', async () => {
      await service.findConsolidadoGuardador({ ...baseArgs, pendenciaPaga: true });

      const args = guardadorConsolidadoRepository.findConsolidado.mock.calls[0][0];
      expect(args.pendenciaPaga).toBe(true);
      expect(args.pago).toBeUndefined();
      expect(args.aPagar).toBeUndefined();
    });

    it('does not leak pendenciaPaga into the pago block when both are selected', async () => {
      const result = await service.findConsolidadoGuardador({
        ...baseArgs,
        pago: true,
        pendenciaPaga: true,
      });

      expect(blockStatuses(result)).toEqual(['pago', 'pendenciaPaga']);
      const pagoCall = guardadorConsolidadoRepository.findConsolidado.mock.calls
        .map(([args]) => args)
        .find((args) => args.status === 'pago');
      expect(pagoCall.pendenciaPaga).toBeUndefined();
    });
  });
});
