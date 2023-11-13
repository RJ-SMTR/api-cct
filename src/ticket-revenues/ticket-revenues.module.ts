import { Module } from '@nestjs/common';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { JaeModule } from 'src/jae/jae.module';
import { UsersModule } from 'src/users/users.module';
import { TicketRevenuesController } from './ticket-revenues.controller';
import { TicketRevenuesService } from './ticket-revenues.service';

@Module({
  imports: [JaeModule, UsersModule, BigqueryModule, UsersModule, JaeModule],
  providers: [TicketRevenuesService],
  controllers: [TicketRevenuesController],
  exports: [TicketRevenuesService],
})
export class TicketRevenuesModule {}
