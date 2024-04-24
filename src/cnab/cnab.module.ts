import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BanksModule } from 'src/banks/banks.module';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { LancamentoModule } from 'src/lancamento/lancamento.module';
import { SettingsModule } from 'src/settings/settings.module';
import { SftpModule } from 'src/sftp/sftp.module';
import { UsersModule } from 'src/users/users.module';
import { CnabController } from './cnab.controller';
import { CnabService } from './cnab.service';
import { ArquivoPublicacao } from './entity/arquivo-publicacao.entity';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ExtratoDetalheE } from './entity/extrato/extrato-detalhe-e.entity';
import { ExtratoHeaderArquivo } from './entity/extrato/extrato-header-arquivo.entity';
import { ExtratoHeaderLote } from './entity/extrato/extrato-header-lote.entity';
import { DetalheA } from './entity/pagamento/detalhe-a.entity';
import { DetalheB } from './entity/pagamento/detalhe-b.entity';
import { HeaderArquivo } from './entity/pagamento/header-arquivo.entity';
import { HeaderLote } from './entity/pagamento/header-lote.entity';
import { ItemTransacao } from './entity/pagamento/item-transacao.entity';
import { Pagador } from './entity/pagamento/pagador.entity';
import { Transacao } from './entity/pagamento/transacao.entity';
import { ArquivoPublicacaoRepository } from './repository/arquivo-publicacao.repository';
import { ClienteFavorecidoRepository } from './repository/cliente-favorecido.repository';
import { ExtratoDetalheERepository } from './repository/extrato/extrato-detalhe-e.repository';
import { ExtratoHeaderArquivoRepository } from './repository/extrato/extrato-header-arquivo.repository';
import { ExtratoHeaderLoteRepository } from './repository/extrato/extrato-header-lote.repository';
import { DetalheARepository } from './repository/pagamento/detalhe-a.repository';
import { DetalheBRepository } from './repository/pagamento/detalhe-b.repository';
import { HeaderArquivoRepository } from './repository/pagamento/header-arquivo.repository';
import { HeaderLoteRepository } from './repository/pagamento/header-lote.repository';
import { ItemTransacaoRepository } from './repository/pagamento/item-transacao.repository';
import { PagadorRepository } from './repository/pagamento/pagador.repository';
import { TransacaoRepository } from './repository/pagamento/transacao.repository';
import { ArquivoPublicacaoService } from './service/arquivo-publicacao.service';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ExtratoDetalheEService } from './service/extrato/extrato-detalhe-e.service';
import { ExtratoHeaderArquivoService } from './service/extrato/extrato-header-arquivo.service';
import { ExtratoHeaderLoteService } from './service/extrato/extrato-header-lote.service';
import { DetalheAService } from './service/pagamento/detalhe-a.service';
import { DetalheBService } from './service/pagamento/detalhe-b.service';
import { HeaderArquivoService } from './service/pagamento/header-arquivo.service';
import { HeaderLoteService } from './service/pagamento/header-lote.service';
import { ItemTransacaoService } from './service/pagamento/item-transacao.service';
import { PagadorService } from './service/pagamento/pagador.service';
import { RemessaRetornoService } from './service/pagamento/remessa-retorno.service';
import { TransacaoService } from './service/pagamento/transacao.service';

@Module({
  imports: [
    UsersModule,
    SftpModule,
    BanksModule,
    BigqueryModule,
    LancamentoModule,
    SettingsModule,
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
    RemessaRetornoService,
  ],
  exports: [
    CnabService,
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
    RemessaRetornoService,
  ],
  controllers: [CnabController]
})
export class CnabModule { }
