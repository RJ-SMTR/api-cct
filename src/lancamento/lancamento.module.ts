import { Module } from '@nestjs/common';
import { LancamentoController } from './lancamento.controller';
import { LancamentoService } from './lancamento.service';
import { LancamentoEntity } from './lancamento.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([LancamentoEntity])],
  controllers: [LancamentoController],
  providers: [LancamentoService],
  exports: [],
})
export class LancamentoModule {}
