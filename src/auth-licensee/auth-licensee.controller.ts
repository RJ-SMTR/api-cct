import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SgtuInterface } from 'src/sgtu/interfaces/sgtu.interface';
import { AuthPreRegisterLicenseeDto } from './dto/auth-pre-register-licensee.dto';
import { AuthLicenseeService } from './auth-licensee.service';

@ApiTags('Auth')
@Controller({
  path: 'auth/licensee',
  version: '1',
})
export class AuthLicenseeController {
  constructor(private service: AuthLicenseeService) {}

  @Post('pre-register')
  @HttpCode(HttpStatus.OK)
  async preRegister(
    @Body() loginDto: AuthPreRegisterLicenseeDto,
  ): Promise<SgtuInterface> {
    const profile = await this.service.getProfileByCredentials(loginDto);
    return profile;
  }
}
