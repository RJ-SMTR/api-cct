import { Module } from '@nestjs/common';
import { AuthLicenseeController } from './auth-licensee.controller';
import { AuthLicenseeService } from './auth-licensee.service';
import { SgtuModule } from 'src/sgtu/sgtu.module';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailModule } from 'src/mail/mail.module';
import { CoreBankModule } from 'src/core-bank/core-bank.module';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { InviteModule } from 'src/invite/invite.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    SgtuModule,
    CoreBankModule,
    UsersModule,
    MailModule,
    InviteModule,
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
  providers: [AuthLicenseeService, BaseValidator],
})
export class AuthLicenseeModule {}
