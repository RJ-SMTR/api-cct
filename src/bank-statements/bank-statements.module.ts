import { Module } from '@nestjs/common';
import { BankStatementsService } from './bank-statements.service';
import { BankStatementsController } from './bank-statements.controller';
import { UsersModule } from 'src/users/users.module';
import { CoreBankModule } from 'src/core-bank/core-bank.module';

@Module({
  providers: [BankStatementsService],
  controllers: [BankStatementsController],
  imports: [UsersModule, CoreBankModule],
})
export class BankStatementsModule {}
