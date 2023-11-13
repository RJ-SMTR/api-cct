import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailCountModule } from 'src/mail-count/mail-count.module';

@Module({
  imports: [ConfigModule, MailCountModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
