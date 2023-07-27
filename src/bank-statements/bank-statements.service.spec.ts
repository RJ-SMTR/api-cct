import { Test, TestingModule } from '@nestjs/testing';
import { BankStatementsService } from './bank-statements.service';

describe('BankStatementsService', () => {
  let service: BankStatementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BankStatementsService],
    }).compile();

    service = module.get<BankStatementsService>(BankStatementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
