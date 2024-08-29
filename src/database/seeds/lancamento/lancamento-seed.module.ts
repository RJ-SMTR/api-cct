import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { Lancamento } from 'src/lancamento/lancamento.entity';
import { User } from 'src/users/entities/user.entity';
import { LancamentoSeedDataService } from './lancamento-seed-data.service';
import { LancamentoSeedService } from './lancamento-seed.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [TypeOrmModule.forFeature([User, ClienteFavorecido, Lancamento]), ConfigModule],
  providers: [LancamentoSeedService, LancamentoSeedDataService],
  exports: [LancamentoSeedService, LancamentoSeedDataService],
})
export class LancamentoSeedModule {}
