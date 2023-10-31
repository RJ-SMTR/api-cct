import { Module } from '@nestjs/common';
import { TicketRevenuesService } from './ticket-revenues.service';
import { TicketRevenuesController } from './ticket-revenues.controller';
import { JaeModule } from 'src/jae/jae.module';
import { UsersModule } from 'src/users/users.module';
import { BigqueryModule } from 'src/bigquery/bigquery.module';

@Module({
  imports: [JaeModule, UsersModule, BigqueryModule, UsersModule],
  providers: [TicketRevenuesService],
  controllers: [TicketRevenuesController],
})
export class TicketRevenuesModule {}
