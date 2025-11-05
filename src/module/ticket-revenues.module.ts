import { Module } from '@nestjs/common';
import { BigqueryModule } from 'src/client/bigquery/bigquery.module';
import { CnabModule } from 'src/configuration/cnab/cnab.module';
import { SettingsModule } from 'src/configuration/settings/settings.module';
import { TicketRevenuesRepositoryService } from '../repository/ticket-revenues.repository';
import { TicketRevenuesService } from '../service/ticket-revenues.service';
import { TicketRevenuesController } from 'src/controller/ticket-revenues.controller';
import { TransacaoViewModule } from './transacao-view.module';
import { UsersModule } from './users.module';

@Module({
  imports: [UsersModule, BigqueryModule, UsersModule, SettingsModule, TransacaoViewModule, CnabModule],
  providers: [TicketRevenuesService, TicketRevenuesRepositoryService],
  controllers: [TicketRevenuesController],
  exports: [TicketRevenuesService, TicketRevenuesRepositoryService],
})
export class TicketRevenuesModule {}
