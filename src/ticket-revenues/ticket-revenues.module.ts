import { Module } from '@nestjs/common';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { UsersModule } from 'src/users/users.module';
import { TicketRevenuesController } from './ticket-revenues.controller';
import { TicketRevenuesService } from './ticket-revenues.service';

@Module({
  imports: [UsersModule, BigqueryModule, UsersModule],
  providers: [TicketRevenuesService],
  controllers: [TicketRevenuesController],
  exports: [TicketRevenuesService],
})
export class TicketRevenuesModule {}
