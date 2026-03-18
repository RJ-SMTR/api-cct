import { Injectable } from '@nestjs/common';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioNovoRemessaFinancialMovementRepository } from './relatorio-novo-remessa-financial-movement.repository';

@Injectable()
export class RelatorioNovoRemessaFinancialMovementService {
  constructor(
    private readonly relatorioNovoRemessaFinancialMovementRepository: RelatorioNovoRemessaFinancialMovementRepository,
  ) { }

  /**
   * Gerar relatórios payandpending - agrupados por Favorecido.
   */
  async findFinancialMovementSummary(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    this.ensureValidDateRange(args);
    return this.relatorioNovoRemessaFinancialMovementRepository.findFinancialMovementSummary(args);
  }

  async findFinancialMovementPage(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    this.ensureValidDateRange(args);
    return this.relatorioNovoRemessaFinancialMovementRepository.findFinancialMovementPage(args);
  }

  private ensureValidDateRange(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    if (args.dataInicio === undefined || args.dataFim === undefined ||
      new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }
  }


}
