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

  it('returns only the emProcessamento block when only emProcessamento is selected', async () => {
    const result = await service.findConsolidadoGuardador({ ...baseArgs, emProcessamento: true });

    expect(blockStatuses(result)).toEqual(['emProcessamento']);
  });

  it('returns only the erros block when only pago is false (regression)', async () => {
    const result = await service.findConsolidadoGuardador({ ...baseArgs, pago: false });

    expect(blockStatuses(result)).toEqual(['erros']);
  });

  it('returns only the erros block when only rejeitado is selected', async () => {
    const result = await service.findConsolidadoGuardador({ ...baseArgs, rejeitado: true });

    expect(blockStatuses(result)).toEqual(['erros']);
  });

  describe('combining pago with other statuses', () => {
    it('returns separate pago and emProcessamento blocks, each isolated from the other', async () => {
      const result = await service.findConsolidadoGuardador({
        ...baseArgs,
        pago: true,
        emProcessamento: true,
      });

      expect(blockStatuses(result)).toEqual(['pago', 'emProcessamento']);
      const calls = guardadorConsolidadoRepository.findConsolidado.mock.calls.map(([args]) => args);
      const pagoCall = calls.find((args) => args.status === 'pago');
      const emProcessamentoCall = calls.find((args) => args.status === 'emProcessamento');
      expect(pagoCall.emProcessamento).toBeUndefined();
      expect(emProcessamentoCall.pago).toBeUndefined();
    });

    it('returns separate pago and erros blocks when combined with rejeitado/estorno', async () => {
      const result = await service.findConsolidadoGuardador({
        ...baseArgs,
        pago: true,
        rejeitado: true,
        estorno: true,
      });

      expect(blockStatuses(result)).toEqual(['pago', 'erros']);
      const calls = guardadorConsolidadoRepository.findConsolidado.mock.calls.map(([args]) => args);
      const pagoCall = calls.find((args) => args.status === 'pago');
      const errosCall = calls.find((args) => args.status === 'erros');
      expect(pagoCall.rejeitado).toBeUndefined();
      expect(pagoCall.estorno).toBeUndefined();
      expect(errosCall.pago).toBeUndefined();
      expect(errosCall.rejeitado).toBe(true);
      expect(errosCall.estorno).toBe(true);
    });

    it('returns separate aPagar and erros blocks when combined with rejeitado', async () => {
      const result = await service.findConsolidadoGuardador({
        ...baseArgs,
        aPagar: true,
        rejeitado: true,
      });

      expect(blockStatuses(result)).toEqual(['aPagar', 'erros']);
    });
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
  // The guardador selector sends the user ids, not the names.
  describe('userIds', () => {
    it('treats userIds as a specific filter and returns only the todos block', async () => {
      const result = await service.findConsolidadoGuardador({ ...baseArgs, userIds: [7, 9] });

      expect(blockStatuses(result)).toEqual(['todos']);
    });

    it('passes the userIds to the repository', async () => {
      await service.findConsolidadoGuardador({ ...baseArgs, userIds: [7, 9] });

      const args = guardadorConsolidadoRepository.findConsolidado.mock.calls[0][0];
      expect(args.userIds).toEqual([7, 9]);
    });
  });
});
