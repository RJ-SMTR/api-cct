import { Module } from '@nestjs/common';
import { BankStatementsService } from './bank-statements.service';
import { BankStatementsController } from './bank-statements.controller';
import { UsersModule } from 'src/users/users.module';

@Module({
  providers: [BankStatementsService],
  controllers: [BankStatementsController],
  imports: [UsersModule],
})
export class BankStatementsModule {}
