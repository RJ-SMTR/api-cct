import { Test, TestingModule } from '@nestjs/testing';
import { RelatorioNovoRemessaController } from './relatorio-novo-remessa.controller';
import { RelatorioNovoRemessaDetalhadoService } from './relatorio-novo-remessa-detalhado.service';
import { makeRelatorioConsolidado } from 'test/factories/make-relatorio-consolidado';
import { describe, beforeEach, it } from 'node:test';

describe('RelatorioNovoRemessaController - Detalhado', () => {
  let controller: RelatorioNovoRemessaController;
  let service: RelatorioNovoRemessaDetalhadoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelatorioNovoRemessaController],
      providers: [
        {
          provide: RelatorioNovoRemessaDetalhadoService,
          useValue: {
            findDetalhado: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RelatorioNovoRemessaController>(RelatorioNovoRemessaController);
    service = module.get<RelatorioNovoRemessaDetalhadoService>(RelatorioNovoRemessaDetalhadoService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDetalhado', () => {
    it('should return detailed report data', async () => {
      const mockResult = makeRelatorioConsolidado()
      jest.spyOn(service, 'findDetalhado').mockResolvedValue(mockResult);

      const result = await controller.getDetalhado(
        new Date('2023-01-01'),
        new Date('2023-01-31'),
        ['Consórcio Teste'],
        100,
        1000,
        true,
        false,
        false,
        false
      );

      expect(result).toEqual(mockResult);
    });

    it('should throw an HttpException on error', async () => {
      jest.spyOn(service, 'findDetalhado').mockRejectedValue(new Error('Service error'));

      await expect(
        controller.getDetalhado(
          new Date('2023-01-01'),
          new Date('2023-01-31'),
          ['Consórcio Teste'],
          100,
          1000,
          true,
          false,
          false,
          false
        )
      ).rejects.toThrow('Service error');
    });
  });
});
