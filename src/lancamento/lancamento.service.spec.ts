import { Test, TestingModule } from '@nestjs/testing';
import { LancamentoService } from './lancamento.service';

describe('LancamentoService', () => {
  let service: LancamentoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LancamentoService],
    }).compile();

    service = module.get<LancamentoService>(LancamentoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
