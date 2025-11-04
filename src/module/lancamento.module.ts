import { Module } from '@nestjs/common';

import { LancamentoController } from '../controller/lancamento.controller';
import { Lancamento } from '../domain/entity/lancamento.entity';
import { LancamentoService } from '../service/lancamento.service';
import { LancamentoRepository } from '../repository/lancamento.repository';
import { ClienteFavorecidoModule } from 'src/module/cliente-favorecido.module';
import { LancamentoHistory } from '../domain/entity/lancamento-history.entity';
import { LancamentoAutorizacao } from '../domain/entity/lancamento-autorizacao.entity';
import { LancamentoAutorizacaoHistory } from '../domain/entity/lancamento-autorizacao-history.entity';
import { LancamentoHistoryRepository } from '../repository/lancamento-history.repository';
import { LancamentoAutorizacaoHistoryRepository } from '../repository/lancamento-autorizacao-history.repository';
import { LancamentoAutorizacaoRepository } from '../repository/lancamento-autorizacao.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lancamento, //
      LancamentoHistory,
      LancamentoAutorizacao,
      LancamentoAutorizacaoHistory,
    ]),
    UsersModule,
    ClienteFavorecidoModule,
  ],
  controllers: [LancamentoController],
  providers: [
    LancamentoService, //
    LancamentoRepository,
    LancamentoHistoryRepository,
    LancamentoAutorizacaoRepository,
    LancamentoAutorizacaoHistoryRepository,
  ],
  exports: [
    LancamentoService, //
    LancamentoRepository,
    LancamentoHistoryRepository,
    LancamentoAutorizacaoRepository,
    LancamentoAutorizacaoHistoryRepository,
  ],
})
export class LancamentoModule {}
