import { Test, TestingModule } from '@nestjs/testing';
import { RelatorioController } from './relatorio.controller';
import { RelatorioNovoRemessaService } from './novo-remessa/relatorio-novo-remessa.service';

describe('RelatorioController', () => {
  let controller: RelatorioController;
  let novoRemessaService: RelatorioNovoRemessaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelatorioController],
      providers: [
        {
          provide: RelatorioNovoRemessaService,
          useValue: { findConsolidadoGuardador: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    controller = module.get<RelatorioController>(RelatorioController);
    novoRemessaService = module.get<RelatorioNovoRemessaService>(RelatorioNovoRemessaService);
  });

  // The query string carried userIds (sent by the frontend's "Selecionar Guardador" filter),
  // but the controller never read nor forwarded it, so selecting a specific guardador on the
  // Consolidado report (GET /cnab/relatorio/consolidadoGuardador) silently returned every
  // guardador instead of just the selected one.
  it('forwards userIds to findConsolidadoGuardador', async () => {
    await controller.getConsolidadoGuardador(
      new Date('2026-09-01'),
      new Date('2026-10-08'),
      [2458],
      undefined,
      ['SINGAERJ'],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    expect(novoRemessaService.findConsolidadoGuardador).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [2458], consorcioNome: ['SINGAERJ'] }),
    );
  });
});
