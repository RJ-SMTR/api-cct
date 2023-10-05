import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InviteStatusSeedService } from './invite-status-seed.service';
import { InviteStatus } from 'src/invite-statuses/entities/invite-status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InviteStatus])],
  providers: [InviteStatusSeedService],
  exports: [InviteStatusSeedService],
})
export class InviteStatusSeedModule {}
