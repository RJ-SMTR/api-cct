import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransacaoView } from './transacao-view.entity';
import { TransacaoViewRepository } from './transacao-view.repository';
import { TransacaoViewService as TransacaoViewService } from './transacao-view.service';

@Module({
  imports: [TypeOrmModule.forFeature([TransacaoView])],
  providers: [TransacaoViewRepository, TransacaoViewService],
  exports: [TransacaoViewRepository, TransacaoViewService],
})
export class TransacaoViewModule {}
