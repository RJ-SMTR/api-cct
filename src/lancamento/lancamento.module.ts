import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { LancamentoController } from './lancamento.controller';
import { Lancamento } from './entities/lancamento.entity';
import { LancamentoService } from './lancamento.service';
import { LancamentoRepository } from './lancamento.repository';
import { ClienteFavorecidoModule } from 'src/cnab/cliente-favorecido.module';
import { LancamentoHistory } from './entities/lancamento-history.entity';
import { LancamentoAutorizacao } from './entities/lancamento-autorizacao.entity';
import { LancamentoAutorizacaoHistory } from './entities/lancamento-autorizacao-history.entity';
import { LancamentoHistoryRepository } from './lancamento-history.repository';
import { LancamentoAutorizacaoHistoryRepository } from './lancamento-autorizacao-history.repository';

@Module({
  imports: [
    UsersModule,
    ClienteFavorecidoModule,
    TypeOrmModule.forFeature([
      Lancamento, //
      LancamentoAutorizacao,
      LancamentoHistory,
      LancamentoAutorizacaoHistory,
    ]),
  ],
  controllers: [LancamentoController],
  providers: [
    LancamentoService, //
    LancamentoRepository,
    LancamentoHistoryRepository,
    LancamentoAutorizacaoHistoryRepository,
  ],
  exports: [
    LancamentoService, //
    LancamentoRepository,
    LancamentoHistoryRepository,
    LancamentoAutorizacaoHistoryRepository,
  ],
})
export class LancamentoModule {}
