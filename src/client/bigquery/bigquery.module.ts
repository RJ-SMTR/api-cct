import { Module } from '@nestjs/common';
import { BigqueryService } from './bigquery.service';
import { ConfigModule } from '@nestjs/config';
import { BigqueryOrdemPagamentoService } from './services/bigquery-ordem-pagamento.service';
import { BigqueryOrdemPagamentoRepository } from './repositories/bigquery-ordem-pagamento.repository';
import { SettingsModule } from 'src/configuration/settings/settings.module';
import { BigqueryTransacaoService } from './services/bigquery-transacao.service';
import { BigqueryTransacaoRepository } from './repositories/bigquery-transacao.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BigqueryTransacaoDiario } from './entities/transaca-diario.entity';

@Module({
  imports: [ConfigModule, SettingsModule, TypeOrmModule.forFeature([BigqueryTransacaoDiario])],
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
