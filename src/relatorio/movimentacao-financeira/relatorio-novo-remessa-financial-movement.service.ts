import { Injectable } from '@nestjs/common';
import { RelatorioNovoRemessaFinancialMovementRepository } from './relatorio-novo-remessa-financial-movement.repository';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';

@Injectable()
export class RelatorioNovoRemessaFinancialMovementService {
  constructor(private relatorioNovoRemessaFinancialMovementRepository: RelatorioNovoRemessaFinancialMovementRepository,
  ) { }

  /**
   * Gerar relatórios payandpending - agrupados por Favorecido.
   */
  async findFinancialMovement(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    if (args.dataInicio === undefined || args.dataFim === undefined ||
      new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioNovoRemessaFinancialMovementRepository.findFinancialMovement(args);
  }


}
