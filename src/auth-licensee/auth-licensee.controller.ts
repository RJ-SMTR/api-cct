import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthPreRegisterLicenseeDto } from './dto/auth-pre-register-licensee.dto';
import { AuthLicenseeService } from './auth-licensee.service';
import { AuthRegisterLicenseeDto } from './dto/auth-register-licensee.dto';
import { LicenseeProfileInterface } from './interfaces/licensee-profile.interface';

@ApiTags('Auth')
@Controller({
  path: 'auth/licensee',
  version: '1',
})
export class AuthLicenseeController {
  constructor(private authLicenseeService: AuthLicenseeService) {}

  @Post('pre-register')
  @HttpCode(HttpStatus.OK)
  async preRegister(
    @Body() loginDto: AuthPreRegisterLicenseeDto,
  ): Promise<LicenseeProfileInterface> {
    const profile = await this.authLicenseeService.getProfileByCredentials(
      loginDto,
    );
    return profile;
  }

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(
    @Body() createUserDto: AuthRegisterLicenseeDto,
  ): Promise<void | object> {
    const ret = await this.authLicenseeService.register(createUserDto);
    console.log(`ret`);
    console.log(ret);
    return ret;
  }
}
