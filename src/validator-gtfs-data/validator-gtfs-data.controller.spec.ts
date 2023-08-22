import { Test, TestingModule } from '@nestjs/testing';
import { ValidatorGtfsDataController } from './validator-gtfs-data.controller';

describe('ValidatorGtfsDataController', () => {
  let controller: ValidatorGtfsDataController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValidatorGtfsDataController],
    }).compile();

    controller = module.get<ValidatorGtfsDataController>(
      ValidatorGtfsDataController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
