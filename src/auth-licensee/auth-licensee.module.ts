import { Module } from '@nestjs/common';
import { AuthLicenseeController } from './auth-licensee.controller';
import { AuthLicenseeService } from './auth-licensee.service';
import { SgtuModule } from 'src/sgtu/sgtu.module';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from 'src/mail/mail.module';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';
import { JwtModule } from '@nestjs/jwt';
import { JaeModule } from 'src/jae/jae.module';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    SgtuModule,
    UsersModule,
    MailModule,
    MailHistoryModule,
    JaeModule,

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
