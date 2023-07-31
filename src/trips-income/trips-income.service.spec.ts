import { Test, TestingModule } from '@nestjs/testing';
import { TripsIncomeService } from './trips-income.service';

describe('TripsIncomeService', () => {
  let service: TripsIncomeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TripsIncomeService],
    }).compile();

    service = module.get<TripsIncomeService>(TripsIncomeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
