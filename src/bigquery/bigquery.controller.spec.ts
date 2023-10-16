import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryController } from './bigquery.controller';

describe('BigqueryController', () => {
  let controller: BigqueryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BigqueryController],
    }).compile();

    controller = module.get<BigqueryController>(BigqueryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
