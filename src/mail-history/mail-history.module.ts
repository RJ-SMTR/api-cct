import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailHistory } from './entities/mail-history.entity';
import { MailHistoryService } from './mail-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([MailHistory])],
  providers: [MailHistoryService],
  exports: [MailHistoryService],
})
export class MailHistoryModule {}
