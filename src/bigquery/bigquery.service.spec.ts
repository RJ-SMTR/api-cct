import { Test, TestingModule } from '@nestjs/testing';
import { BigqueryService } from './bigquery.service';

describe('BigqueryService', () => {
  let service: BigqueryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BigqueryService],
    }).compile();

    service = module.get<BigqueryService>(BigqueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
