import { Module } from '@nestjs/common';
import { JaeService } from './jae.service';

@Module({
  providers: [JaeService],
  exports: [JaeService],
})
export class JaeModule {}
