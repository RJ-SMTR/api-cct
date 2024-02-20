import { Module } from '@nestjs/common';
import { CnabService } from './cnab.service';

@Module({
  providers: [CnabService],
})
export class CnabModule {}
