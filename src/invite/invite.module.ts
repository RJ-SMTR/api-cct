import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailHistory } from './entities/invite.entity';
import { MailHistoryService } from './mail-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([MailHistory])],
  providers: [MailHistoryService],
  exports: [MailHistoryService],
})
export class InviteModule {}
