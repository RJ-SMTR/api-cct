import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { LancamentoController } from './lancamento.controller';
import { LancamentoEntity } from './lancamento.entity';
import { LancamentoService } from './lancamento.service';
import { LancamentoRepository } from './lancamento.repository';

@Module({
  imports: [TypeOrmModule.forFeature([LancamentoEntity]),
    UsersModule,
  ],
  controllers: [LancamentoController],
  providers: [LancamentoService, LancamentoRepository],
  exports: [LancamentoService, LancamentoRepository],
})
export class LancamentoModule { }
