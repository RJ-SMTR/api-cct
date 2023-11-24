import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bank } from 'src/banks/entities/bank.entity';
import { InitSeedService } from './init-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Bank]), ConfigModule],
  providers: [InitSeedService],
  exports: [InitSeedService],
})
export class InitSeedModule {}
