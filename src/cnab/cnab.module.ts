import { Module } from '@nestjs/common';
import { CnabService } from './service/cnab.service';
import { HeaderArquivoService } from './service/pagamento/header-arquivo.service';
import { HeaderLoteRepository } from './repository/pagamento/header-lote.repository';
import { HeaderLoteService } from './service/pagamento/header-lote.service';
import { DetalheAService } from './service/pagamento/detalhe-a.service';
import { DetalheARepository } from './repository/pagamento/detalhe-a.repository';
import { DetalheBService } from './service/pagamento/detalhe-b.service';
import { DetalheBRepository } from './repository/pagamento/detalhe-b.repository';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ClienteFavorecidoRepository } from './repository/cliente-favorecido.repository';
import { PagadorService } from './service/pagamento/pagador.service';
import { PagadorRepository } from './repository/pagamento/pagador.repository';
import { ArquivoPublicacaoRepository } from './repository/arquivo-publicacao.repository';
import { TransacaoService } from './service/pagamento/transacao.service';
import { TransacaoRepository } from './repository/pagamento/transacao.repository';
import { ItemTransacaoService } from './service/pagamento/item-transacao.service';
import { ItemTransacaoRepository } from './repository/pagamento/item-transacao.repository';
import { SftpModule } from 'src/sftp/sftp.module';
import { HeaderArquivoRepository } from './repository/pagamento/header-arquivo.repository';
import { Cnab104Service } from './service/cnab-104.service';
import { BanksModule } from 'src/banks/banks.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderArquivo } from './entity/pagamento/header-arquivo.entity';
import { HeaderLote } from './entity/pagamento/header-lote.entity';
import { DetalheA } from './entity/pagamento/detalhe-a.entity';
import { DetalheB } from './entity/pagamento/detalhe-b.entity';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ArquivoPublicacao } from './entity/arquivo-publicacao.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { ItemTransacao } from './entity/pagamento/item-transacao.entity';
import { Pagador } from './entity/pagamento/pagador.entity';
import { UsersModule } from 'src/users/users.module';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { CnabController } from './cnab.controller';
import { ExtratoHeaderArquivo } from './entity/extrato/extrato-header-arquivo.entity';
import { ExtratoHeaderLote } from './entity/extrato/extrato-header-lote.entity';
import { ExtratoDetalheE } from './entity/extrato/extrato-detalhe-e.entity';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ExtratoHeaderArquivoRepository } from './repository/extrato/extrato-header-arquivo.repository';
import { ExtratoHeaderLoteRepository } from './repository/extrato/extrato-header-lote.repository';
import { ExtratoHeaderLoteService } from './service/extrato/extrato-header-lote.service';
import { ExtratoDetalheEService } from './service/extrato/extrato-detalhe-e.service';
import { ExtratoDetalheERepository } from './repository/extrato/extrato-detalhe-e.repository';
import { PagamentoService } from './service/pagamento/pagamento.service';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';

@Module({
  imports: [
    UsersModule,
    SftpModule,
    BanksModule,
    BigqueryModule,
    TypeOrmModule.forFeature([
      HeaderArquivo,
      HeaderLote,
      DetalheA,
      DetalheB,
      ClienteFavorecido,
      ArquivoPublicacao,
      Transacao,
      ItemTransacao,
      Pagador,
      ExtratoHeaderArquivo,
      ExtratoHeaderLote,
      ExtratoDetalheE,
    ])
  ],
  providers: [
    CnabService,
    Cnab104Service,
    HeaderArquivoRepository,
    HeaderArquivoService,
    HeaderLoteRepository,
    HeaderLoteService,
    DetalheARepository,
    DetalheAService,
    DetalheBRepository,
    DetalheBService,
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
    PagamentoService,
  ],
  exports: [
    CnabService,
    Cnab104Service,
    HeaderArquivoRepository,
    HeaderArquivoService,
    HeaderLoteRepository,
    HeaderLoteService,
    DetalheARepository,
    DetalheAService,
    DetalheBRepository,
    DetalheBService,
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
    PagamentoService,
  ],
  controllers: [CnabController]
})
export class CnabModule { }
