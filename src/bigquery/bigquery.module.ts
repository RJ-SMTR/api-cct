import { Module } from '@nestjs/common';
import { BigqueryService } from './bigquery.service';
import { ConfigModule } from '@nestjs/config';
import { BigqueryOrdemPagamentoService } from './services/bigquery-ordem-pagamento.service';
import { BigqueryOrdemPagamentoRepository } from './repositories/bigquery-ordem-pagamento.repository';
import { SettingsModule } from 'src/settings/settings.module';
import { BigqueryTransacaoService } from './services/bigquery-transacao.service';
import { BigqueryTransacaoRepository } from './repositories/bigquery-transacao.repository';

@Module({
  imports: [ConfigModule, SettingsModule],
  providers: [
    BigqueryService,
    BigqueryOrdemPagamentoService,
    BigqueryOrdemPagamentoRepository,
    BigqueryTransacaoRepository,
    BigqueryTransacaoService,
  ],
  exports: [
    BigqueryService,
    BigqueryOrdemPagamentoRepository,
    BigqueryOrdemPagamentoService,
    BigqueryTransacaoRepository,
    BigqueryTransacaoService,
  ],
})
export class BigqueryModule { }
