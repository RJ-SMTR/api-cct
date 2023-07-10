import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';

@Module({
  providers: [InviteService],
  exports: [InviteService],
})
export class InviteModule {}
