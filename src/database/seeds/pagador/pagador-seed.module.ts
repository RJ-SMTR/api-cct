import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagadorSeedService } from './pagador-seed.service';
import { Pagador } from 'src/domain/entity/pagador.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Pagador])],
  providers: [PagadorSeedService],
  exports: [PagadorSeedService],
})
export class PagadorSeedModule { }
