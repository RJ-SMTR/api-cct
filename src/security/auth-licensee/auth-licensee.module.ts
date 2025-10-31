import { Module } from '@nestjs/common';
import { AuthLicenseeController } from './auth-licensee.controller';
import { AuthLicenseeService } from './auth-licensee.service';
import { AuthModule } from 'src/security/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from 'src/module/mail.module';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { MailHistoryModule } from 'src/module/mail-history.module';
import { JwtModule } from '@nestjs/jwt';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { UsersModule } from 'src/module/users.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    UsersModule,
    MailModule,
    MailHistoryModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('auth.secret'),
        signOptions: {
          expiresIn: configService.get('auth.expires'),
        },
      }),
    }),
  ],
  controllers: [AuthLicenseeController],
  providers: [AuthLicenseeService, BaseValidator, IsNotExist],
})
export class AuthLicenseeModule {}
