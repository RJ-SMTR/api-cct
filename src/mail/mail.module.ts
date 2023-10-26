import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailCountService } from 'src/mail-count/mail-count.service';

@Module({
  imports: [ConfigModule, MailCountService],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
