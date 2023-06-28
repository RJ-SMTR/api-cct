import { Test, TestingModule } from '@nestjs/testing';
import { AuthLicenseeService } from './auth-licensee.service';

describe('AuthLicenseeService', () => {
  let service: AuthLicenseeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthLicenseeService],
    }).compile();

    service = module.get<AuthLicenseeService>(AuthLicenseeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
