import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteStatusSeedService } from './mail-history-status-seed.service';
import { InviteStatus } from 'src/mail-history-statuses/entities/mail-history-status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InviteStatus])],
  providers: [InviteStatusSeedService],
  exports: [InviteStatusSeedService],
})
export class InviteStatusSeedModule {}
