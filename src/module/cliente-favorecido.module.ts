import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClienteFavorecido } from '../domain/entity/cliente-favorecido.entity';
import { ClienteFavorecidoRepository } from '../repository/cliente-favorecido.repository';
import { ClienteFavorecidoService } from '../service/cliente-favorecido.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClienteFavorecido])],
  providers: [ClienteFavorecidoRepository, ClienteFavorecidoService],
  exports: [ClienteFavorecidoRepository, ClienteFavorecidoService],
  controllers: [],
})
export class ClienteFavorecidoModule {}
