import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClienteFavorecidoSeedService } from './cliente-favorecido-seed.service';
import { ClienteFavorecido } from 'src/domain/entity/cliente-favorecido.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClienteFavorecido])],
  providers: [ClienteFavorecidoSeedService],
  exports: [ClienteFavorecidoSeedService],
})
export class ClienteFavorecidoSeedModule { }
