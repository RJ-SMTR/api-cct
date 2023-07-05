import { Test, TestingModule } from '@nestjs/testing';
import { AuthWhatsappService } from './auth-whatsapp.service';

describe('AuthWhatsappService', () => {
  let service: AuthWhatsappService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthWhatsappService],
    }).compile();

    service = module.get<AuthWhatsappService>(AuthWhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
