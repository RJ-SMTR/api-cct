import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from 'src/config/config.type';
import { ValidationCodeService } from 'src/validation-code/validation-code.service';
import { UsersService } from 'src/users/users.service';
import { ValidationCodeDestinationEnum } from 'src/validation-code/validation-code-destination/validation-code-destination.enum';
import { ValidationCodeMethodEnum } from 'src/validation-code/validation-code-method/validation-code-method.enum';
import { AuthWhatsappConfirmDto } from './dto/auth-whatsapp-confirm.dto';
import { AuthWhatsappBaseDataDto } from './dto/auth-whatsapp-base-data.dto';

@Injectable()
export class AuthWhatsappService {
  constructor(
    private configService: ConfigService<AllConfigType>,
    private usersService: UsersService,
    private validationCodeService: ValidationCodeService,
    private httpService: HttpService,
  ) {}

  private async sendMessage(
    phone: string,
    type: string,
    extraData: object = {},
  ): Promise<any> {
    const senderPhoneId = this.configService.getOrThrow(
      'whatsapp.senderPhoneId',
      {
        infer: true,
      },
    );
    const accessTokenSecret = this.configService.getOrThrow(
      'whatsapp.accessTokenSecret',
      {
        infer: true,
      },
    );

    const apiUrl = `https://graph.facebook.com/v17.0/${senderPhoneId}/messages`;

    const headers = {
      Authorization: `Bearer ${accessTokenSecret}`,
      'Content-Type': 'application/json',
    };

    const data = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
    };
    data[type] = extraData;

    try {
      const response = await this.httpService.axiosRef.post(apiUrl, data, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.error(error?.response?.data || error.message);
      throw new Error('Failed to send message:');
    }
  }

  private async sendMessageAsTemplate(
    phone: string,
    code: string,
  ): Promise<any> {
    return this.sendMessage(phone, 'template', {
      name: 'auth_phone',
      language: {
        code: 'pt_BR',
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: code,
            },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: code,
            },
          ],
        },
      ],
    });
  }

  async sendPhoneCode(
    baseData: AuthWhatsappBaseDataDto,
    newPhone?: string,
  ): Promise<any> {
    // user is possibly null
    if (baseData.user === null) {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            user: 'userNotFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (newPhone) {
      await this.usersService.update(baseData.user.id, {
        phone: newPhone,
      });
    }

    const code = Math.floor(0 + Math.random() * 999999).toString();

    await this.validationCodeService.createEncrypted(
      {
        user: baseData.user,
        destination: ValidationCodeDestinationEnum.phone,
        method: ValidationCodeMethodEnum.whatsapp,
      },
      code,
    );

    const phone = baseData.user.phone || newPhone;

    if (!phone) {
      throw new HttpException(
        {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            user: 'phoneNotFound',
          },
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // this.sendMessageAsTemplate(phone, code);
    return { code: code };
  }

  async confirmPhoneCode(dto: AuthWhatsappConfirmDto): Promise<void> {
    const user = await this.usersService.findOne({
      email: dto.email,
    });

    if (!user) {
      throw new HttpException(
        {
          status: HttpStatus.NOT_FOUND,
          error: `userNotFound`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.validationCodeService.findDecrypt(
      {
        destination: ValidationCodeDestinationEnum.phone,
        method: ValidationCodeMethodEnum.whatsapp,
        user: user,
      },
      dto.code,
    );

    await this.usersService.update(user.id, {
      isPhoneValidated: true,
    });
  }
}
