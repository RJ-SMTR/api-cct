import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankService } from './core-bank.service';

describe('CoreBankService', () => {
  let service: CoreBankService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CoreBankService],
    }).compile();

    service = module.get<CoreBankService>(CoreBankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
