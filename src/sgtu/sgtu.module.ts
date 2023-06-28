import { Module } from '@nestjs/common';
import { SgtuService } from './sgtu.service';

@Module({
  providers: [SgtuService],
  exports: [SgtuService],
})
export class SgtuModule {}
