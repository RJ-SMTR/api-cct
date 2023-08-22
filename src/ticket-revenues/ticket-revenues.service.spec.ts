import { Test, TestingModule } from '@nestjs/testing';
import { TicketRevenuesService } from './ticket-revenues.service';

describe('TicketRevenuesService', () => {
  let service: TicketRevenuesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketRevenuesService],
    }).compile();

    service = module.get<TicketRevenuesService>(TicketRevenuesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
