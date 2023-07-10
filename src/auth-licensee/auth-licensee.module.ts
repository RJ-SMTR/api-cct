import { Module } from '@nestjs/common';
import { AuthLicenseeController } from './auth-licensee.controller';
import { AuthLicenseeService } from './auth-licensee.service';
import { SgtuModule } from 'src/sgtu/sgtu.module';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from 'src/mail/mail.module';
import { CoreBankModule } from 'src/core-bank/core-bank.module';
import { BaseValidator } from 'src/utils/validators/base-validator';
import { InviteModule } from 'src/invite/invite.module';
import { InviteHashExistsConstraint } from 'src/invite/validators/invite-hash-exists.validator';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    SgtuModule,
    CoreBankModule,
    UsersModule,
    MailModule,
    InviteModule,
  ],
  controllers: [AuthLicenseeController],
  providers: [AuthLicenseeService, BaseValidator, InviteHashExistsConstraint],
})
export class AuthLicenseeModule {}
