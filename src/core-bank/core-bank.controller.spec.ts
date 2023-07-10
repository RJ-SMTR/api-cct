import { Test, TestingModule } from '@nestjs/testing';
import { CoreBankController } from './core-bank.controller';

describe('CoreBankController', () => {
  let controller: CoreBankController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CoreBankController],
    }).compile();

    controller = module.get<CoreBankController>(CoreBankController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
