import { Test, TestingModule } from '@nestjs/testing';
import { ValidatorGtfsDataService } from './validator-gtfs-data.service';

describe('ValidatorGtfsDataService', () => {
  let validatorGtfsDataService: ValidatorGtfsDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidatorGtfsDataService],
    }).compile();

    validatorGtfsDataService = module.get<ValidatorGtfsDataService>(
      ValidatorGtfsDataService,
    );
  });

  it('should be defined', () => {
    expect(validatorGtfsDataService).toBeDefined();
  });
});
