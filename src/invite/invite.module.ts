import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invite } from './entities/invite.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invite])],
  providers: [InviteService],
  exports: [InviteService],
})
export class InviteModule {}
