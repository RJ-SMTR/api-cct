import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CnabModule } from 'src/cnab/cnab.module';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaRequisicaoInterceptor } from './auditoria-requisicao.interceptor';
import { AuditoriaService } from './auditoria.service';
import { ReconciliacaoService } from './reconciliacao.service';

@Module({
  imports: [CnabModule],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, ReconciliacaoService, { provide: APP_INTERCEPTOR, useClass: AuditoriaRequisicaoInterceptor }],
})
export class AuditoriaModule {}
