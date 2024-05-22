import { Injectable } from '@nestjs/common';
import { isFriday, nextFriday, subDays } from 'date-fns';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { Between, IsNull } from 'typeorm';
import { TransacaoView } from './transacao-view.entity';
import { TransacaoViewRepository } from './transacao-view.repository';

@Injectable()
export class TransacaoViewService {
  constructor(private transacaoViewRepository: TransacaoViewRepository) {}

  save = this.transacaoViewRepository.save;
  findMany = this.transacaoViewRepository.findMany;
  findOne = this.transacaoViewRepository.findOne;
  getOne = this.transacaoViewRepository.getOne;

  async upsert(dtos: TransacaoView[]) {
    return await this.transacaoViewRepository.upsert(dtos);
  }

  async updateForArquivoPublicacao(publicacao: ArquivoPublicacao) {
    let friday = new Date();
    if (isFriday(friday)) {
      friday = nextFriday(friday);
    }
    const qui = subDays(friday, 8);
    const qua = subDays(friday, 2);
    /**
     * datetimeProcessamento = D+0 (data + hora)
     * dataOrdem = D+1 (data)
     */
    const transacoesView = await this.transacaoViewRepository.findMany({
      where: {
        idConsorcio: publicacao.itemTransacao.idConsorcio || IsNull(),
        idOperadora: publicacao.itemTransacao.idOperadora || IsNull(),
        datetimeProcessamento: Between(qui, qua),
      },
    });

    await this.transacaoViewRepository.upsert(
      transacoesView.map((i) => ({
        datetimeProcessamento: i.datetimeProcessamento,
        arquivoPublicacao: { id: publicacao.id },
      })),
    );
  }
}
