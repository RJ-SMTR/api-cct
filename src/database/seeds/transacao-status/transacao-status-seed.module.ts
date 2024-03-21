import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransacaoStatusSeedService } from './transacao-status-seed.service';
import { TransacaoStatus } from 'src/cnab/entity/intermediate/transacao-status.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TransacaoStatus])],
  providers: [TransacaoStatusSeedService],
  exports: [TransacaoStatusSeedService],
})
export class TransacaoStatusSeedModule { }
