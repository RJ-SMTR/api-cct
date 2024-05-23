import { Module } from '@nestjs/common';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { UsersModule } from 'src/users/users.module';
import { TicketRevenuesRepositoryService } from './ticket-revenues-repository';
import { TicketRevenuesController } from './ticket-revenues.controller';
import { TicketRevenuesService } from './ticket-revenues.service';
import { SettingsModule } from 'src/settings/settings.module';
import { TransacaoViewModule } from 'src/transacao-bq/transacao-view.module';
import { CnabModule } from 'src/cnab/cnab.module';

@Module({
  imports: [
    UsersModule,
    BigqueryModule,
    UsersModule,
    SettingsModule,
    TransacaoViewModule,
    CnabModule,
  ],
  providers: [TicketRevenuesService, TicketRevenuesRepositoryService],
  controllers: [TicketRevenuesController],
  exports: [TicketRevenuesService, TicketRevenuesRepositoryService],
})
export class TicketRevenuesModule {}
