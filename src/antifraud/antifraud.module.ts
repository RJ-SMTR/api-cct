import { Module } from '@nestjs/common';
import { CnabModule } from 'src/cnab/cnab.module';
import { MailModule } from 'src/mail/mail.module';
import { SettingsModule } from 'src/settings/settings.module';
import { AntifraudService } from './antifraud.service';

@Module({
  imports: [CnabModule, MailModule, SettingsModule],
  providers: [AntifraudService],
  exports: [AntifraudService],
})
export class AntifraudModule {}
