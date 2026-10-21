import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaRequisicaoInterceptor } from './auditoria-requisicao.interceptor';
import { AuditoriaService } from './auditoria.service';
import { ReconciliacaoService } from './reconciliacao.service';

@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, ReconciliacaoService, { provide: APP_INTERCEPTOR, useClass: AuditoriaRequisicaoInterceptor }],
})
export class AuditoriaModule {}
