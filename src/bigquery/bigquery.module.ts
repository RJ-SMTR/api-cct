import { Module } from '@nestjs/common';
import { BigqueryService } from './bigquery.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [BigqueryService],
  exports: [BigqueryService],
})
export class BigqueryModule {}
