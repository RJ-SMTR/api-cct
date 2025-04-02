import { Injectable } from '@nestjs/common';
import { IFindPublicacaoRelatorioNovoRemessa } from './interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { RelatorioNovoRemessaDetalhadoRepository } from './relatorio-novo-remessa-detalhado.repository';

@Injectable()
export class RelatorioNovoRemessaDetalhadoService {
  constructor(private relatorioNovoRemessaDetalhadoRepository: RelatorioNovoRemessaDetalhadoRepository,
  ) { }

  /**
   * Gerar relatórios detalhado - agrupados por Favorecido.
   */
  async findDetalhado(args: IFindPublicacaoRelatorioNovoRemessa) {
    if (args.dataInicio === undefined || args.dataFim === undefined ||
      new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioNovoRemessaDetalhadoRepository.findDetalhado(args);
  }


}
