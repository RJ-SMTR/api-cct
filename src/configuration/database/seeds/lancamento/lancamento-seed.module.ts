import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClienteFavorecido } from 'src/domain/entity/cliente-favorecido.entity';
import { Lancamento } from 'src/domain/entity/lancamento.entity';
import { LancamentoSeedDataService } from './lancamento-seed-data.service';
import { LancamentoSeedService } from './lancamento-seed.service';
import { ConfigModule } from '@nestjs/config';
import { User } from 'src/domain/entity/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, ClienteFavorecido, Lancamento]), ConfigModule],
  providers: [LancamentoSeedService, LancamentoSeedDataService],
  exports: [LancamentoSeedService, LancamentoSeedDataService],
})
export class LancamentoSeedModule {}
