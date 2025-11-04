// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// // import { CnabUpdateTransacaoViewBqSeedService } from './cnab-update-transacao-view-bq-seed.service';
// import { Bank } from 'src/banks/entities/bank.entity';
// import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
// import { DetalheB } from 'src/cnab/entity/pagamento/detalhe-b.entity';
// import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
// import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
// import { ItemTransacao } from 'src/cnab/entity/pagamento/item-transacao.entity';
// import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';
// import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
// import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
// import { TransacaoView } from 'src/transacao-view/transacao-view.entity';
// import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
// import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';

// @Module({
//   imports: [
//     TypeOrmModule.forFeature([
//       DetalheA,
//       DetalheB,
//       HeaderLote,
//       HeaderArquivo,
//       ItemTransacao,
//       ItemTransacaoAgrupado,
//       Transacao,
//       TransacaoAgrupado,
//       TransacaoView,
//       ArquivoPublicacao,
//       ClienteFavorecido,
//     ]),
//   ],
//   providers: [CnabUpdateTransacaoViewBqSeedService],
//   exports: [CnabUpdateTransacaoViewBqSeedService],
// })
// export class CnabUpdateTransacaoViewBqModule {}
