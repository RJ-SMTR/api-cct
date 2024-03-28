import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemTransacaoStatus } from 'src/cnab/entity/pagamento/item-transacao-status.entity';
import { ItemTransacaoStatusSeedService } from './item-transacao-status-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItemTransacaoStatus])],
  providers: [ItemTransacaoStatusSeedService],
  exports: [ItemTransacaoStatusSeedService],
})
export class ItemTransacaoStatusSeedModule { }
