import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { LancamentoController } from './lancamento.controller';
import { Lancamento } from './lancamento.entity';
import { LancamentoService } from './lancamento.service';
import { LancamentoRepository } from './lancamento.repository';
import { ClienteFavorecidoModule } from 'src/cnab/cliente-favorecido.module';

@Module({
  imports: [
    UsersModule,
    ClienteFavorecidoModule,
    TypeOrmModule.forFeature([Lancamento]), //
  ],
  controllers: [LancamentoController],
  providers: [LancamentoService, LancamentoRepository],
  exports: [LancamentoService, LancamentoRepository],
})
export class LancamentoModule {}
