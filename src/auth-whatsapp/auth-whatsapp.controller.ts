import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthWhatsappService } from './auth-whatsapp.service';
import { AuthWhatsappVerifyDto } from './dto/auth-whatsapp-verify.dto';
import { AuthWhatsappConfirmDto as AuthWhatsappConfirmDto } from './dto/auth-whatsapp-confirm.dto';
import { UsersService } from 'src/users/users.service';
import { AuthWhatsappBaseDataDto } from './dto/auth-whatsapp-base-data.dto';
import { BaseValidator } from 'src/utils/validators/base-validator';

@ApiTags('Auth')
@Controller({
  path: 'auth/whatsapp',
  version: '1',
})
export class AuthWhatsappController {
  constructor(
    private readonly authWhatsappService: AuthWhatsappService,
    private readonly usersService: UsersService,
    private baseValidator: BaseValidator,
  ) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: AuthWhatsappVerifyDto) {
    const user = await this.usersService.findOne({ email: dto.email });
    const baseData: AuthWhatsappBaseDataDto = { user: user };
    await this.baseValidator.validateOrReject(
      baseData,
      AuthWhatsappBaseDataDto,
    );
    const response = await this.authWhatsappService.sendPhoneCode(
      baseData,
      dto.phone,
    );
    return response;
  }

  @Post('confirm')
  // @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPhone(@Body() dto: AuthWhatsappConfirmDto): Promise<undefined> {
    await this.authWhatsappService.confirmPhoneCode(dto);
  }
}
