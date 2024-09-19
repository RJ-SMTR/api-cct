import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { LancamentoController } from './lancamento.controller';
import { Lancamento } from './entities/lancamento.entity';
import { LancamentoService } from './lancamento.service';
import { LancamentoRepository } from './repositories/lancamento.repository';
import { ClienteFavorecidoModule } from 'src/cnab/cliente-favorecido.module';
import { LancamentoHistory } from './entities/lancamento-history.entity';
import { LancamentoAutorizacao } from './entities/lancamento-autorizacao.entity';
import { LancamentoAutorizacaoHistory } from './entities/lancamento-autorizacao-history.entity';
import { LancamentoHistoryRepository } from './repositories/lancamento-history.repository';
import { LancamentoAutorizacaoHistoryRepository } from './repositories/lancamento-autorizacao-history.repository';
import { LancamentoAutorizacaoRepository } from './repositories/lancamento-autorizacao.repository';

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
