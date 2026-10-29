import { Module } from '@nestjs/common';
import { ControleRemessaErroController } from './controle-remessa-erro.controller';
import { ControleRemessaErroService } from './controle-remessa-erro.service';

@Module({
  controllers: [ControleRemessaErroController],
  providers: [ControleRemessaErroService],
})
export class ControleRemessaErroModule {}
