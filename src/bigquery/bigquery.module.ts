import { Module } from '@nestjs/common';
import { BigqueryController } from './bigquery.controller';

@Module({
  controllers: [BigqueryController],
})
export class BigqueryModule {}
