import { Module } from '@nestjs/common';
import { ValidatorGtfsDataController } from './validator-gtfs-data.controller';
import { ValidatorGtfsDataService } from './validator-gtfs-data.service';
import { UsersModule } from 'src/users/users.module';
import { JaeModule } from 'src/jae/jae.module';

@Module({
  imports: [JaeModule, UsersModule],
  controllers: [ValidatorGtfsDataController],
  providers: [ValidatorGtfsDataService],
})
export class ValidatorGtfsDataModule {}
