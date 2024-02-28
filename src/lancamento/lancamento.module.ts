import { Module } from '@nestjs/common';
import { LancamentoController } from './lancamento.controller';
import { LancamentoService } from './lancamento.service';
import { LancamentoEntity } from './lancamento.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LancamentoEntity]),
    UsersModule
  ],
  controllers: [LancamentoController],
  providers: [LancamentoService],
  exports: [],
})
export class LancamentoModule {}
