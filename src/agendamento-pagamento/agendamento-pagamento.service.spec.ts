import { Test, TestingModule } from '@nestjs/testing';
import { AgendamentoPagamentoService } from './agendamento-pagamento.service';

describe('AgendamentoPagamentoService', () => {
  let service: AgendamentoPagamentoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AgendamentoPagamentoService],
    }).compile();

    service = module.get<AgendamentoPagamentoService>(AgendamentoPagamentoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
