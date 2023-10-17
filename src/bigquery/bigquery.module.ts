import { Module } from '@nestjs/common';
import { BigqueryService } from './bigquery.service';

@Module({
  providers: [BigqueryService],
  exports: [BigqueryService],
})
export class BigqueryModule {}
