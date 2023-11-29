import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AnonymousStrategy } from './strategies/anonymous.strategy';
import { UsersModule } from 'src/users/users.module';
import { ForgotModule } from 'src/forgot/forgot.module';
import { MailModule } from 'src/mail/mail.module';
import { IsExist } from 'src/utils/validators/is-exists.validator';
import { IsNotExist } from 'src/utils/validators/is-not-exists.validator';
import { CoreBankService } from 'src/core-bank/core-bank.service';
import { IsValidBankCodeConstraint } from 'src/banks/validators/is-valid-bank-code.validator';
import { CoreBankModule } from 'src/core-bank/core-bank.module';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';

@Module({
  imports: [
    UsersModule,
    ForgotModule,
    PassportModule,
    MailModule,
    CoreBankModule,
    MailHistoryModule,
    ConfigModule,
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
  controllers: [AuthController],
  providers: [
    IsExist,
    IsNotExist,
    AuthService,
    JwtStrategy,
    AnonymousStrategy,
    CoreBankService,
    IsValidBankCodeConstraint,
  ],
  exports: [AuthService],
})
export class AuthModule {}
