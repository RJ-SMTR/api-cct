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
import { PagadorService } from './service/intermediate/pagador.service';
import { PagadorRepository } from './repository/intermediate/pagador.repository';
import { ArquivoPublicacaoRepository } from './repository/arquivo-publicacao.repository';
import { TransacaoService } from './service/intermediate/transacao.service';
import { TransacaoRepository } from './repository/intermediate/transacao.repository';
import { ItemTransacaoService } from './service/intermediate/item-transacao.service';
import { ItemTransacaoRepository } from './repository/intermediate/item-transacao.repository';
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
import { Transacao } from './entity/intermediate/transacao.entity';
import { ItemTransacao } from './entity/intermediate/item-transacao.entity';
import { Pagador } from './entity/intermediate/pagador.entity';
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
