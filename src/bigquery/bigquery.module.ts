import { Module } from '@nestjs/common';
import { BigqueryService } from './bigquery.service';
import { ConfigModule } from '@nestjs/config';
import { BigqueryOrdemPagamentoService } from './services/bigquery-ordem-pagamento.service';
import { BigqueryOrdemPagamentoRepository } from './repositories/bigquery-ordem-pagamento.repository';
import { SettingsModule } from 'src/settings/settings.module';

@Module({
  imports: [ConfigModule, SettingsModule],
  providers: [
    BigqueryService,
    BigqueryOrdemPagamentoService,
    BigqueryOrdemPagamentoRepository,
  ],
  exports: [
    BigqueryService,
    BigqueryOrdemPagamentoService,
    BigqueryOrdemPagamentoRepository,
  ],
})
export class BigqueryModule { }
