import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransacaoView } from 'src/domain/entity/transacao-view.entity';
import { TransacaoViewRepository } from 'src/repository/transacao-view.repository';
import { TransacaoViewService } from 'src/service/transacao-view.service';

@Module({
  imports: [TypeOrmModule.forFeature([TransacaoView])],
  providers: [TransacaoViewRepository, TransacaoViewService],
  exports: [TransacaoViewRepository, TransacaoViewService],
})
export class TransacaoViewModule {}
