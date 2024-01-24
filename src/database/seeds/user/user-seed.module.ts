import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { UserSeedDataService } from './user-seed-data.service';
import { UserSeedService } from './user-seed.service';
import { ConfigModule } from '@nestjs/config';
import { BigqueryModule } from 'src/bigquery/bigquery.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule, BigqueryModule],
  providers: [UserSeedService, UserSeedDataService],
  exports: [UserSeedService, UserSeedDataService],
})
export class UserSeedModule {}
