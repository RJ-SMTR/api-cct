import { Test, TestingModule } from '@nestjs/testing';
import { TicketRevenuesController } from './ticket-revenues.controller';

describe('TicketRevenuesController', () => {
  let controller: TicketRevenuesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketRevenuesController],
    }).compile();

    controller = module.get<TicketRevenuesController>(TicketRevenuesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
