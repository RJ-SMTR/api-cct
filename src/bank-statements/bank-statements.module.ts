import { Module } from '@nestjs/common';
import { CoreBankModule } from 'src/core-bank/core-bank.module';
import { TicketRevenuesModule } from 'src/ticket-revenues/ticket-revenues.module';
import { UsersModule } from 'src/users/users.module';
import { BankStatementsController } from './bank-statements.controller';
import { BankStatementsService } from './bank-statements.service';

@Module({
  providers: [BankStatementsService],
  controllers: [BankStatementsController],
  imports: [UsersModule, CoreBankModule, TicketRevenuesModule],
})
export class BankStatementsModule {}
