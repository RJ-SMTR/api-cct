import { Module } from '@nestjs/common';
import { CoreBankService } from './core-bank.service';
import { CoreBankDataService } from './data/core-bank-data.service';

@Module({
  providers: [CoreBankService, CoreBankDataService],
  exports: [CoreBankService, CoreBankDataService],
})
export class CoreBankModule {}
