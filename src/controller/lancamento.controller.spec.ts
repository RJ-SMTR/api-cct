import { Test, TestingModule } from '@nestjs/testing';
import { LancamentoController } from './lancamento.controller';

describe('LancamentoController', () => {
  let controller: LancamentoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LancamentoController],
    }).compile();

    controller = module.get<LancamentoController>(LancamentoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
