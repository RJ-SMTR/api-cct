import { Module } from '@nestjs/common';
import { TicketRevenuesModule } from 'src/ticket-revenues/ticket-revenues.module';
import { UsersModule } from 'src/users/users.module';
import { BankStatementsRepositoryService } from './bank-statements.repository';
import { BankStatementsController } from './bank-statements.controller';
import { BankStatementsService } from './bank-statements.service';
import { CnabModule } from 'src/cnab/cnab.module';
import { TransacaoViewModule } from 'src/transacao-view/transacao-view.module';

@Module({
  providers: [BankStatementsService, BankStatementsRepositoryService],
  controllers: [BankStatementsController],
  imports: [UsersModule, TicketRevenuesModule, CnabModule, TransacaoViewModule],
})
export class BankStatementsModule {}
