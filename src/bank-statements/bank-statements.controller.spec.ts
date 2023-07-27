import { Test, TestingModule } from '@nestjs/testing';
import { BankStatementsController } from './bank-statements.controller';

describe('BankStatementsController', () => {
  let controller: BankStatementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BankStatementsController],
    }).compile();

    controller = module.get<BankStatementsController>(BankStatementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
