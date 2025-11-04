import { ItemTransacao } from '../entity/item-transacao.entity';
import { Ocorrencia } from '../entity/ocorrencia.entity';

export class IArquivoPublicacaoWithOcorrencias {
  constructor(dto?: IArquivoPublicacaoWithOcorrencias) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id: number;
  idTransacao: number;
  itemTransacao: ItemTransacao;
  isPago: boolean;
  dataGeracaoRetorno: Date;
  horaGeracaoRetorno: Date;
  dataVencimento: Date;
  dataEfetivacao: Date;
  valorRealEfetivado: number;
  createdAt: Date;
  updatedAt: Date;
  ocorrencias: Ocorrencia[];
}
