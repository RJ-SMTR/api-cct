import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSeedDataService } from './user-seed-data.service';
import { UserSeedService } from './user-seed.service';
import { ConfigModule } from '@nestjs/config';
import { BigqueryModule } from 'src/client/bigquery/bigquery.module';
import { User } from 'src/domain/entity/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User]), ConfigModule, BigqueryModule],
  providers: [UserSeedService, UserSeedDataService],
  exports: [UserSeedService, UserSeedDataService],
})
export class UserSeedModule {}
