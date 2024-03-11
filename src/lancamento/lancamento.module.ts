import { Module } from '@nestjs/common';
import { LancamentoController } from './lancamento.controller';
import { LancamentoService } from './lancamento.service';
import { LancamentoEntity } from './lancamento.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from 'src/users/users.module';
import { CnabModule } from 'src/cnab/cnab.module';

@Module({
  imports: [TypeOrmModule.forFeature([LancamentoEntity]),
    UsersModule,
    CnabModule
  ],
  controllers: [LancamentoController],
  providers: [LancamentoService],
  exports: [],
})
export class LancamentoModule {}
