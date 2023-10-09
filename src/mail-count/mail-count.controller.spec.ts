import { Test, TestingModule } from '@nestjs/testing';
import { MailCountController } from './mail-count.controller';

describe('SentMailCountController', () => {
  let controller: MailCountController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MailCountController],
    }).compile();

    controller = module.get<MailCountController>(MailCountController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
