import { Module } from '@nestjs/common';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { UsersModule } from 'src/users/users.module';
import { TicketRevenuesRepositoryService } from './ticket-revenues-repository.service';
import { TicketRevenuesController } from './ticket-revenues.controller';
import { TicketRevenuesService } from './ticket-revenues.service';
import { SettingsModule } from 'src/settings/settings.module';

@Module({
  imports: [UsersModule, BigqueryModule, UsersModule, SettingsModule],
  providers: [TicketRevenuesService, TicketRevenuesRepositoryService],
  controllers: [TicketRevenuesController],
  exports: [TicketRevenuesService, TicketRevenuesRepositoryService],
})
export class TicketRevenuesModule {}
