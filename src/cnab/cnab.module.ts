import { Module } from '@nestjs/common';
import { CnabService } from './service/cnab.service';

@Module({
  providers: [CnabService],
})
export class CnabModule { }
