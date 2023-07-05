import { Module } from '@nestjs/common';
import { AuthWhatsappService } from './auth-whatsapp.service';
import { AuthWhatsappController } from './auth-whatsapp.controller';
import { HttpModule } from '@nestjs/axios';
import { ValidationCodeModule } from 'src/validation-code/validation-code';
import { UsersModule } from 'src/users/users.module';
import { NoRecentValidationCodesConstraint } from 'src/validation-code/validators/max-recent-validation-codes.validator';
import { IsEqualsConstraint } from 'src/utils/validators/is-equals.validator';
import { BaseValidator } from 'src/utils/validators/base-validator';

@Module({
  imports: [
    UsersModule,
    ValidationCodeModule,
    HttpModule.registerAsync({
      useFactory: () => ({
        timeout: 5000,
        maxRedirects: 5,
      }),
    }),
  ],
  providers: [
    AuthWhatsappService,
    NoRecentValidationCodesConstraint,
    IsEqualsConstraint,
    BaseValidator,
  ],
  controllers: [AuthWhatsappController],
})
export class AuthWhatsappModule {}
