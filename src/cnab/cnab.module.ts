import { Module } from '@nestjs/common';
import { CnabService } from './service/cnab.service';
import { HeaderArquivoService } from './service/header-arquivo.service';
import { HeaderLoteRepository } from './repository/header-lote.repository';
import { HeaderLoteService } from './service/header-lote.service';
import { DetalheAService } from './service/detalhe-a.service';
import { DetalheARepository } from './repository/detalhe-a.repository';
import { DetalheBService } from './service/detalhe-b.service';
import { DetalheBRepository } from './repository/detalhe-b.repository';
import { ClienteFavorecidoService } from './service/cliente-favorecido.service';
import { ClienteFavorecidoRepository } from './repository/cliente-favorecido.repository';
import { PagadorService } from './service/pagador.service';
import { PagadorRepository } from './repository/pagador.repository';
import { ArquivoPublicacaoRepository } from './repository/arquivo-publicacao.repository';
import { TransacaoService } from './service/transacao.service';
import { TransacaoRepository } from './repository/transacao.repository';
import { ItemTransacaoService } from './service/item-transacao.service';
import { ItemTransacaoRepository } from './repository/item-transacao.repository';
import { SftpModule } from 'src/sftp/sftp.module';
import { HeaderArquivoRepository } from './repository/header-arquivo.repository';
import { Cnab104Service } from './service/cnab-104.service';
import { BanksModule } from 'src/banks/banks.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderArquivo } from './entity/header-arquivo.entity';
import { HeaderLote } from './entity/header-lote.entity';
import { DetalheA } from './entity/detalhe-a.entity';
import { DetalheB } from './entity/detalhe-b.entity';
import { ClienteFavorecido } from './entity/cliente-favorecido.entity';
import { ArquivoPublicacao } from './entity/arquivo-publicacao.entity';
import { Transacao } from './entity/transacao.entity';
import { ItemTransacao } from './entity/item-transacao.entity';
import { Pagador } from './entity/pagador.entity';
import { UsersModule } from 'src/users/users.module';
import { BigqueryModule } from 'src/bigquery/bigquery.module';
import { CnabController } from './cnab.controller';

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
    ])
  ],
  providers: [
    CnabService,
    Cnab104Service,
    HeaderArquivoService,
    HeaderArquivoRepository,
    HeaderLoteRepository,
    HeaderLoteService,
    DetalheAService,
    DetalheARepository,
    DetalheBService,
    DetalheBRepository,
    ClienteFavorecidoService,
    ClienteFavorecidoRepository,
    PagadorService,
    PagadorRepository,
    ArquivoPublicacaoRepository,
    TransacaoService,
    TransacaoRepository,
    ItemTransacaoService,
    ItemTransacaoRepository,
  ],
  exports: [
    CnabService,
    Cnab104Service,
    HeaderArquivoService,
    HeaderArquivoRepository,
    HeaderLoteRepository,
    HeaderLoteService,
    DetalheAService,
    DetalheARepository,
    DetalheBService,
    DetalheBRepository,
    ClienteFavorecidoService,
    ClienteFavorecidoRepository,
    PagadorService,
    PagadorRepository,
    ArquivoPublicacaoRepository,
    TransacaoService,
    TransacaoRepository,
    ItemTransacaoService,
    ItemTransacaoRepository,
  ],
  controllers: [CnabController]
})
export class CnabModule { }
