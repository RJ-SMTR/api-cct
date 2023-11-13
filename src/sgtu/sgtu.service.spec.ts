import { Test, TestingModule } from '@nestjs/testing';
import { SgtuService } from './sgtu.service';

describe('SgtuService', () => {
  let service: SgtuService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SgtuService],
    }).compile();

    service = module.get<SgtuService>(SgtuService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
