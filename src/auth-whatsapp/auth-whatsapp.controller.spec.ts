import { Test, TestingModule } from '@nestjs/testing';
import { AuthWhatsappController } from './auth-whatsapp.controller';

describe('AuthWhatsappController', () => {
  let controller: AuthWhatsappController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthWhatsappController],
    }).compile();

    controller = module.get<AuthWhatsappController>(AuthWhatsappController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
