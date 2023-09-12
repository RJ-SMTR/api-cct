import { Module } from '@nestjs/common';
import { JaeService } from './jae.service';
import { HttpModule } from '@nestjs/axios';
import { JaeDataService } from './data/jae-data.service';

@Module({
  imports: [HttpModule],
  providers: [JaeService, JaeDataService],
  exports: [JaeService],
})
export class JaeModule {}
