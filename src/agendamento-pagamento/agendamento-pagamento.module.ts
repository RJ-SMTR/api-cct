import { Module } from '@nestjs/common';
import { AgendamentoPagamentoService } from './agendamento-pagamento.service';
import { AgendamentoPagamentoController } from './agendamento-pagamento.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendamentoPagamento } from './agendamento-pagamento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AgendamentoPagamento])],
  providers: [AgendamentoPagamentoService],
  controllers: [AgendamentoPagamentoController],
  exports: [AgendamentoPagamentoService],
})
export class AgendamentoPagamentoModule {}
