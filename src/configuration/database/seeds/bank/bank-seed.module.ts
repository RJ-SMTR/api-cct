import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankSeedService } from './bank-seed.service';
import { Bank } from 'src/domain/entity/bank.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Bank])],
  providers: [BankSeedService],
  exports: [BankSeedService],
})
export class BankSeedModule {}
