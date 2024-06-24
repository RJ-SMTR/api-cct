// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { bankData } from './cnab-update-transacao-view-bq-seed-data';
// import { Bank } from 'src/banks/entities/bank.entity';
// import { DetalheA } from 'src/cnab/entity/pagamento/detalhe-a.entity';
// import { DetalheB } from 'src/cnab/entity/pagamento/detalhe-b.entity';
// import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
// import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';

// @Injectable()
// export class CnabUpdateTransacaoViewBqSeedService {
//   constructor(
//     @InjectRepository(DetalheA)
//     private detalheARepository: Repository<DetalheA>,
//     @InjectRepository(DetalheB)
//     private detalheBRepository: Repository<DetalheB>,
//     @InjectRepository(HeaderLote)
//     private headerLoteRepository: Repository<HeaderLote>,
//     @InjectRepository(HeaderArquivo)
//     private headerArquivoRepository: Repository<HeaderArquivo>,
//   ) {}

//   async validateRun() {
//     return Promise.resolve(true);
//   }

//   async run() {
//     const items = bankData
//       .filter((i) => !isNaN(i.ispb))
//       .map((item, index) =>
//         this.detalheARepository.create({
//           id: index + 1,
//           ispb: item.ispb,
//           code: item.code,
//           name: item.name,
//           fullName: item.fullName,
//           isAllowed: true,
//         }),
//       );
//     await this.detalheARepository.clear();
//     await this.detalheARepository.insert(items);
//   }
// }
