import { Test, TestingModule } from '@nestjs/testing';
import { TripsIncomeController } from './trips-income.controller';

describe('TripsIncomeController', () => {
  let controller: TripsIncomeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TripsIncomeController],
    }).compile();

    controller = module.get<TripsIncomeController>(TripsIncomeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
