import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailService } from '../service/mail.service';
import { MailCountModule } from 'src/module/mail-count.module';

@Module({
  imports: [ConfigModule, MailCountModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
