import { Test, TestingModule } from '@nestjs/testing';
import { JaeService } from './jae.service';

describe('JaeService', () => {
  let service: JaeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JaeService],
    }).compile();

    service = module.get<JaeService>(JaeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
