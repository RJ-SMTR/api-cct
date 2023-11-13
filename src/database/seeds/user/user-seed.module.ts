import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { UserSeedDataService } from './user-seed-data.service';
import { UserSeedService } from './user-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserSeedService, UserSeedDataService],
  exports: [UserSeedService],
})
export class UserSeedModule {}
