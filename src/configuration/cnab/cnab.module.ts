import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BanksModule } from 'src/module/banks.module';
import { BigqueryModule } from 'src/client/bigquery/bigquery.module';
import { PagamentosPendentesRepository } from 'src/repository/pagamentos-pendentes.repository';
import { LancamentoModule } from 'src/module/lancamento.module';
import { SettingsModule } from 'src/configuration/settings/settings.module';
import { SftpModule } from 'src/configuration/sftp/sftp.module';

import { CnabController } from './cnab.controller';
import { CnabService } from './cnab.service';
import { ArquivoPublicacao } from '../../domain/entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from '../../domain/entity/cliente-favorecido.entity';
import { ExtratoDetalheE } from '../../domain/entity/extrato-detalhe-e.entity';
import { ExtratoHeaderArquivo } from '../../domain/entity/extrato-header-arquivo.entity';
import { ExtratoHeaderLote } from '../../domain/entity/extrato-header-lote.entity';
import { DetalheA } from '../../domain/entity/detalhe-a.entity';
import { DetalheB } from '../../domain/entity/detalhe-b.entity';
import { HeaderArquivo } from '../../domain/entity/header-arquivo.entity';
import { HeaderLote } from '../../domain/entity/header-lote.entity';
import { ItemTransacaoAgrupado } from '../../domain/entity/item-transacao-agrupado.entity';
import { ItemTransacao } from '../../domain/entity/item-transacao.entity';
import { Ocorrencia } from '../../domain/entity/ocorrencia.entity';
import { Pagador } from '../../domain/entity/pagador.entity';
import { PagamentosPendentes } from '../../domain/entity/pagamentos-pendentes.entity';
import { TransacaoAgrupado } from '../../domain/entity/transacao-agrupado.entity';
import { Transacao } from '../../domain/entity/transacao.entity';
import { ArquivoPublicacaoRepository } from '../../repository/arquivo-publicacao.repository';
import { ClienteFavorecidoRepository } from '../../repository/cliente-favorecido.repository';
import { ExtratoDetalheERepository } from '../../repository/extrato-detalhe-e.repository';
import { ExtratoHeaderArquivoRepository } from '../../repository/extrato-header-arquivo.repository';
import { ExtratoHeaderLoteRepository } from '../../repository/extrato-header-lote.repository';
import { OcorrenciaRepository } from '../../repository/ocorrencia.repository';
import { DetalheARepository } from '../../repository/detalhe-a.repository';
import { DetalheBRepository } from '../../repository/detalhe-b.repository';
import { HeaderArquivoRepository } from '../../repository/header-arquivo.repository';
import { HeaderLoteRepository } from '../../repository/header-lote.repository';
import { ItemTransacaoAgrupadoRepository } from '../../repository/item-transacao-agrupado.repository';
import { ItemTransacaoRepository } from '../../repository/item-transacao.repository';
import { PagadorRepository } from '../../repository/pagador.repository';
import { TransacaoAgrupadoRepository } from '../../repository/transacao-agrupado.repository';
import { TransacaoRepository } from '../../repository/transacao.repository';
import { ArquivoPublicacaoService } from '../../service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from '../../service/cliente-favorecido.service';
import { ExtratoDetalheEService } from '../../service/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from '../../service/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from '../../service/extrato-header-lote.service';
import { OcorrenciaService } from '../../service/ocorrencia.service';
import { DetalheAService } from '../../service/detalhe-a.service';
import { DetalheBService } from '../../service/detalhe-b.service';
import { HeaderArquivoService } from '../../service/header-arquivo.service';
import { HeaderLoteService } from '../../service/header-lote.service';
import { ItemTransacaoAgrupadoService } from '../../service/item-transacao-agrupado.service';
import { ItemTransacaoService } from '../../service/item-transacao.service';
import { PagadorService } from '../../service/pagador.service';
import { PagamentosPendentesService } from '../../service/pagamentos-pendentes.service';
import { RemessaRetornoService } from '../../service/remessa-retorno.service';
import { TransacaoAgrupadoService } from '../../service/transacao-agrupado.service';
import { TransacaoService } from '../../service/transacao.service';
import { PagamentoIndevidoService } from 'src/service/pgamento-indevido-service';
import { PagamentoIndevidoRepository } from 'src/repository/pagamento-indevido.repository';
import { PagamentoIndevido } from 'src/domain/entity/pagamento-indevido.entity';
import { OrdemPagamento } from '../../domain/entity/ordem-pagamento.entity';
import { OrdemPagamentoAgrupado } from '../../domain/entity/ordem-pagamento-agrupado.entity';
import { OrdemPagamentoService } from '../../service/ordem-pagamento.service';
import { OrdemPagamentoRepository } from '../../repository/ordem-pagamento.repository';
import { OrdemPagamentoAgrupadoRepository } from '../../repository/ordem-pagamento-agrupado.repository';
import { OrdemPagamentoAgrupadoService } from '../../service/ordem-pagamento-agrupado.service';
import {
  OrdemPagamentoAgrupadoHistoricoRepository
} from '../../repository/ordem-pagamento-agrupado-historico.repository';
import { OrdemPagamentoAgrupadoHistorico } from '../../domain/entity/ordem-pagamento-agrupado-historico.entity';
import { RemessaService } from '../../service/remessa.service';
import { RetornoService } from '../../service/retorno.service';
import { DistributedLockService } from '../../service/distributed-lock.service';
import { DistributedLockRepository } from '../../repository/distributed-lock.repository';
import { BigqueryTransacaoService } from 'src/client/bigquery/services/bigquery-transacao.service';
import { OrdemPagamentoController } from 'src/controller/ordem-pagamento.controller';
import { TransacaoViewModule } from 'src/module/transacao-view.module';
import { UsersModule } from 'src/module/users.module';

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
    BigqueryTransacaoService,
    ClienteFavorecidoRepository,
    ClienteFavorecidoService,
    CnabService,
    DetalheARepository,
    DetalheAService,
    DetalheBRepository,
    DetalheBService,
    ExtratoDetalheERepository,
    ExtratoDetalheEService,
    ExtratoHeaderArquivoRepository,
    ExtratoHeaderArquivoService,
    ExtratoHeaderLoteRepository,
    ExtratoHeaderLoteService,
    HeaderArquivoRepository,
    HeaderArquivoService,
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
    BigqueryTransacaoService,
    HeaderLoteRepository,
    HeaderLoteService,
    DetalheARepository,
    DetalheAService,
    DetalheBRepository,
    DetalheBService,   
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
