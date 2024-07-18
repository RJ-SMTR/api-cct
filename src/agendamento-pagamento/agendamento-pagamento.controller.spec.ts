import { Test, TestingModule } from '@nestjs/testing';
import { AgendamentoPagamentoController } from './agendamento-pagamento.controller';

describe('AgendamentoPagamentoController', () => {
  let controller: AgendamentoPagamentoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgendamentoPagamentoController],
    }).compile();

    controller = module.get<AgendamentoPagamentoController>(AgendamentoPagamentoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
