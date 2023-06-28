import { Test, TestingModule } from '@nestjs/testing';
import { AuthLicenseeController } from './auth-licensee.controller';

describe('AuthLicenseeController', () => {
  let controller: AuthLicenseeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthLicenseeController],
    }).compile();

    controller = module.get<AuthLicenseeController>(AuthLicenseeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
