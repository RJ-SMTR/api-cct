import { Module } from '@nestjs/common';
import { TicketRevenuesModule } from 'src/module/ticket-revenues.module';
import { BankStatementsRepositoryService } from '../repository/bank-statements.repository';
import { CnabModule } from 'src/configuration/cnab/cnab.module';
import { BankStatementsController } from 'src/controller/bank-statements.controller';
import { TransacaoViewModule } from './transacao-view.module';
import { UsersModule } from './users.module';
import { BankStatementsService } from 'src/service/bank-statements.service';


@Module({
  providers: [BankStatementsService, BankStatementsRepositoryService],
  controllers: [BankStatementsController],
  imports: [UsersModule, TicketRevenuesModule, CnabModule, TransacaoViewModule],
})
export class BankStatementsModule {}
