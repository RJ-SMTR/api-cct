import { Module } from '@nestjs/common';
import { BanksController } from '../controller/banks.controller';
import { BanksService } from '../service/banks.service';
import { Bank } from '../domain/entity/bank.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Bank])],
  controllers: [BanksController],
  providers: [BanksService],
  exports: [BanksService],
})
export class BanksModule {}
