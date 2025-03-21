import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BanksModule } from 'src/banks/banks.module';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { PagamentosPendentesRepository } from 'src/cnab/repository/pagamento/pagamentos-pendentes.repository';
import { LancamentoModule } from 'src/lancamento/lancamento.module';
import { SettingsModule } from 'src/settings/settings.module';
import { SftpModule } from 'src/sftp/sftp.module';
import { TransacaoViewModule } from 'src/transacao-view/transacao-view.module';
import { UsersModule } from 'src/users/users.module';
import { CnabController } from './cnab.controller';
import { CnabService } from './cnab.service';
import { ArquivoPublicacao } from './entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { DetalheAConf } from './entity/conference/detalhe-a-conf.entity';
import { DetalheBConf } from './entity/conference/detalhe-b-conf.entity';
import { HeaderArquivoConf } from './entity/conference/header-arquivo-conf.entity';
import { HeaderLoteConf } from './entity/conference/header-lote-conf.entity';
import { ExtratoDetalheE } from './entity/extrato/extrato-detalhe-e.entity';
import { ExtratoHeaderArquivo } from './entity/extrato/extrato-header-arquivo.entity';
import { ExtratoHeaderLote } from './entity/extrato/extrato-header-lote.entity';
import { DetalheA } from './entity/pagamento/detalhe-a.entity';
import { DetalheB } from './entity/pagamento/detalhe-b.entity';
import { HeaderArquivo } from './entity/pagamento/header-arquivo.entity';
import { HeaderLote } from './entity/pagamento/header-lote.entity';
import { ItemTransacaoAgrupado } from './entity/pagamento/item-transacao-agrupado.entity';
import { ItemTransacao } from './entity/pagamento/item-transacao.entity';
import { Ocorrencia } from './entity/pagamento/ocorrencia.entity';
import { Pagador } from './entity/pagamento/pagador.entity';
import { PagamentosPendentes } from './entity/pagamento/pagamentos-pendentes.entity';
import { TransacaoAgrupado } from './entity/pagamento/transacao-agrupado.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { ArquivoPublicacaoRepository } from './repository/arquivo-publicacao.repository';
import { ClienteFavorecidoRepository } from './repository/cliente-favorecido.repository';
import { ExtratoDetalheERepository } from './repository/extrato/extrato-detalhe-e.repository';
import { ExtratoHeaderArquivoRepository } from './repository/extrato/extrato-header-arquivo.repository';
import { ExtratoHeaderLoteRepository } from './repository/extrato/extrato-header-lote.repository';
import { OcorrenciaRepository } from './repository/ocorrencia.repository';
import { DetalheAConfRepository } from './repository/pagamento/detalhe-a-conf.repository';
import { DetalheARepository } from './repository/pagamento/detalhe-a.repository';
import { DetalheBConfRepository } from './repository/pagamento/detalhe-b-conf.repository';
import { DetalheBRepository } from './repository/pagamento/detalhe-b.repository';
import { HeaderArquivoConfRepository } from './repository/pagamento/header-arquivo-conf.repository';
import { HeaderArquivoRepository } from './repository/pagamento/header-arquivo.repository';
import { HeaderLoteConfRepository } from './repository/pagamento/header-lote-conf.repository';
import { HeaderLoteRepository } from './repository/pagamento/header-lote.repository';
import { ItemTransacaoAgrupadoRepository } from './repository/pagamento/item-transacao-agrupado.repository';
import { ItemTransacaoRepository } from './repository/pagamento/item-transacao.repository';
import { PagadorRepository } from './repository/pagamento/pagador.repository';
import { TransacaoAgrupadoRepository } from './repository/pagamento/transacao-agrupado.repository';
import { TransacaoRepository } from './repository/pagamento/transacao.repository';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDetalheEService } from './service/extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './service/extrato/extrato-header-lote.service';
import { OcorrenciaService } from './service/ocorrencia.service';
import { DetalheAConfService } from './service/pagamento/detalhe-a-conf.service';
import { DetalheAService } from './service/pagamento/detalhe-a.service';
import { DetalheBConfService } from './service/pagamento/detalhe-b-conf.service';
import { DetalheBService } from './service/pagamento/detalhe-b.service';
import { HeaderArquivoConfService } from './service/pagamento/header-arquivo-conf.service';
import { HeaderArquivoService } from './service/pagamento/header-arquivo.service';
import { HeaderLoteConfService } from './service/pagamento/header-lote-conf.service';
import { HeaderLoteService } from './service/pagamento/header-lote.service';
import { ItemTransacaoAgrupadoService } from './service/pagamento/item-transacao-agrupado.service';
import { ItemTransacaoService } from './service/pagamento/item-transacao.service';
import { PagadorService } from './service/pagamento/pagador.service';
import { PagamentosPendentesService } from './service/pagamento/pagamentos-pendentes.service';
import { RemessaRetornoService } from './service/pagamento/remessa-retorno.service';
import { TransacaoAgrupadoService } from './service/pagamento/transacao-agrupado.service';
import { TransacaoService } from './service/pagamento/transacao.service';
import { PagamentoIndevidoService } from 'src/pagamento_indevido/service/pgamento-indevido-service';
import { PagamentoIndevidoRepository } from 'src/pagamento_indevido/repository/pagamento-indevido.repository';
import { PagamentoIndevido } from 'src/pagamento_indevido/entity/pagamento-indevido.entity';
import { OrdemPagamento } from './novo-remessa/entity/ordem-pagamento.entity';
import { OrdemPagamentoAgrupado } from './novo-remessa/entity/ordem-pagamento-agrupado.entity';
import { OrdemPagamentoService } from './novo-remessa/service/ordem-pagamento.service';
import { OrdemPagamentoRepository } from './novo-remessa/repository/ordem-pagamento.repository';
import { OrdemPagamentoAgrupadoRepository } from './novo-remessa/repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoAgrupadoService } from './novo-remessa/service/ordem-pagamento-agrupado.service';
import {
  OrdemPagamentoAgrupadoHistoricoRepository
} from './novo-remessa/repository/ordem-pagamento-agrupado-historico.repository';
import { OrdemPagamentoAgrupadoHistorico } from './novo-remessa/entity/ordem-pagamento-agrupado-historico.entity';
import { OrdemPagamentoController } from './novo-remessa/controller/ordem-pagamento.controller';
import { RemessaService } from './novo-remessa/service/remessa.service';
import { RetornoService } from './novo-remessa/service/retorno.service';
import { DistributedLockService } from './novo-remessa/service/distributed-lock.service';
import { DistributedLockRepository } from './novo-remessa/repository/distributed-lock.repository';

@Module({
  imports: [
    BanksModule, //
    BigqueryModule,
    LancamentoModule,
    SettingsModule,
    SftpModule,
    TransacaoViewModule,
    UsersModule,
    TypeOrmModule.forFeature([
      HeaderArquivoConf, //
      HeaderLoteConf,
      DetalheAConf,
      DetalheBConf,
      HeaderArquivo,
      HeaderLote,
      DetalheA,
      DetalheB,
      PagamentosPendentes,
      ClienteFavorecido,
      ArquivoPublicacao,
      Transacao,
      TransacaoAgrupado,
      Ocorrencia,
      ItemTransacao,
      ItemTransacaoAgrupado,
      Pagador,
      ExtratoHeaderArquivo,
      ExtratoHeaderLote,
      ExtratoDetalheE,
      PagamentoIndevido,
      OrdemPagamento,
      OrdemPagamentoAgrupado,
      OrdemPagamentoAgrupadoHistorico
    ]),
  ],
  providers: [
    ArquivoPublicacaoRepository, //
    ArquivoPublicacaoService,
    ClienteFavorecidoRepository,
    ClienteFavorecidoService,
    CnabService,
    DetalheAConfRepository,
    DetalheAConfService,
    DetalheARepository,
    DetalheAService,
    DetalheBConfRepository,
    DetalheBConfService,
    DetalheBRepository,
    DetalheBService,
    ExtratoDetalheERepository,
    ExtratoDetalheEService,
    ExtratoHeaderArquivoRepository,
    ExtratoHeaderArquivoService,
    ExtratoHeaderLoteRepository,
    ExtratoHeaderLoteService,
    HeaderArquivoConfRepository,
    HeaderArquivoConfService,
    HeaderArquivoRepository,
    HeaderArquivoService,
    HeaderLoteConfRepository,
    HeaderLoteConfService,
    HeaderLoteRepository,
    HeaderLoteService,
    ItemTransacaoAgrupadoRepository,
    ItemTransacaoAgrupadoService,
    ItemTransacaoRepository,
    ItemTransacaoService,
    OcorrenciaRepository,
    OcorrenciaService,
    PagadorRepository,
    PagadorService,
    PagamentosPendentesRepository,
    PagamentosPendentesService,
    RemessaRetornoService,
    TransacaoAgrupadoRepository,
    TransacaoAgrupadoService,
    TransacaoRepository,
    TransacaoService,
    PagamentoIndevidoRepository,
    PagamentoIndevidoService,
    OrdemPagamentoService,
    OrdemPagamentoRepository,
    OrdemPagamentoAgrupadoRepository,
    OrdemPagamentoAgrupadoService,
    OrdemPagamentoAgrupadoHistoricoRepository,
    RemessaService,
    RetornoService,
    DistributedLockService,
    DistributedLockRepository
  ],
  exports: [
    CnabService, //
    HeaderArquivoRepository,
    HeaderArquivoService,
    HeaderLoteRepository,
    HeaderLoteService,
    DetalheARepository,
    DetalheAService,
    DetalheBRepository,
    DetalheBService,
    HeaderArquivoConfRepository,
    HeaderArquivoConfService,
    HeaderLoteConfRepository,
    HeaderLoteConfService,
    DetalheAConfRepository,
    DetalheAConfService,
    DetalheBConfRepository,
    DetalheBConfService,
    PagamentosPendentesRepository,
    PagamentosPendentesService,
    ClienteFavorecidoRepository,
    ClienteFavorecidoService,
    PagadorRepository,
    PagadorService,
    ArquivoPublicacaoRepository,
    ArquivoPublicacaoService,
    TransacaoRepository,
    TransacaoService,
    ItemTransacaoRepository,
    ItemTransacaoService,
    ExtratoHeaderArquivoRepository,
    ExtratoHeaderArquivoService,
    ExtratoHeaderLoteRepository,
    ExtratoHeaderLoteService,
    ExtratoDetalheERepository,
    ExtratoDetalheEService,
    RemessaRetornoService,
    OcorrenciaService,
    PagamentoIndevidoRepository,
    PagamentoIndevidoService,
    OrdemPagamentoService,
    OrdemPagamentoRepository,
    OrdemPagamentoAgrupadoRepository,
    OrdemPagamentoAgrupadoService,
    OrdemPagamentoAgrupadoHistoricoRepository,
    RemessaService,
    RetornoService,
    DistributedLockService,
    DistributedLockRepository
  ],
  controllers: [CnabController, OrdemPagamentoController],
})
export class CnabModule {}
