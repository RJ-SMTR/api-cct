import { Module } from '@nestjs/common';
import { TicketRevenuesModule } from 'src/ticket-revenues/ticket-revenues.module';
import { UsersModule } from 'src/users/users.module';
import { BankStatementsRepositoryService } from './bank-statements-repository.service';
import { BankStatementsController } from './bank-statements.controller';
import { BankStatementsService } from './bank-statements.service';

@Module({
  providers: [BankStatementsService, BankStatementsRepositoryService],
  controllers: [BankStatementsController],
  imports: [UsersModule, TicketRevenuesModule],
})
export class BankStatementsModule {}
