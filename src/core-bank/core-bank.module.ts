import { Module } from '@nestjs/common';
import { CoreBankService } from './core-bank.service';

@Module({
  providers: [CoreBankService],
  exports: [CoreBankService],
})
export class CoreBankModule {}
