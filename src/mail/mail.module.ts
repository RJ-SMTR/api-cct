import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailCountModule } from 'src/mail-count/mail-count.module';
import { MailHistoryModule } from 'src/mail-history/mail-history.module';
import { SettingsModule } from 'src/settings/settings.module';

@Module({
  imports: [ConfigModule, MailCountModule, MailHistoryModule, SettingsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
