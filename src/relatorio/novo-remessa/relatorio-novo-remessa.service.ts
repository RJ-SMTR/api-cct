import { Injectable } from '@nestjs/common';

import { IFindPublicacaoRelatorioNovoRemessa } from '../interfaces/find-publicacao-relatorio-novo-remessa.interface';
import { IFindPublicacaoRelatorio } from '../interfaces/find-publicacao-relatorio.interface';
import { IFindPublicacaoRelatorioNovoFinancialMovement } from '../interfaces/filter-publicacao-relatorio-novo-financial-movement.interface';
import { RelatorioNovoRemessaConsolidadoRepository } from './relatorio-novo-remessa-consolidado.repository';
import { RelatorioNovoRemessaMovimentacaoRepository } from './relatorio-novo-remessa-movimentacao.repository';
import { RelatorioGuardadorConsolidadoRepository } from '../consolidado/relatorio-guardador-consolidado.repository';
import { RelatorioGuardadorFinancialMovementRepository } from '../movimentacao-financeira/relatorio-guardador-financial-movement.repository';
import { RelatorioExtratoBancarioResponseDto } from '../dtos/relatorio-extrato-bancario-response.dto';
import { RelatorioConsolidadoResultDto } from '../dtos/relatorio-consolidado-result.dto';
import { IFindExtrato } from '../interfaces/find-extrato.interface';
import { RelatorioExtratoBancarioRepository } from '../extrato-bancario/relatorio-extrato-bancario.repository';

@Injectable()
export class RelatorioNovoRemessaService {
  constructor(    
    private relatorioNovoRemessaConsolidadoRepository: RelatorioNovoRemessaConsolidadoRepository,
    private relatorioNovoRemessaMovimentacaoRepository: RelatorioNovoRemessaMovimentacaoRepository,
    private relatorioExtratoRepository: RelatorioExtratoBancarioRepository,
    private relatorioGuardadorConsolidadoRepository: RelatorioGuardadorConsolidadoRepository,
    private relatorioGuardadorFinancialMovementRepository: RelatorioGuardadorFinancialMovementRepository,
  ) {}

  /**
   * Gerar relatórios consolidados - agrupados por Favorecido (Permissionários).
   */
  async findConsolidado(args: IFindPublicacaoRelatorioNovoRemessa) {
    if (args.dataInicio === undefined || args.dataFim === undefined || new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioNovoRemessaConsolidadoRepository.findConsolidado(args);
  }

  /**
   * Gerar relatórios consolidados para Guardadores no formato de blocos por status (usado pelo frontend AgentsConsolidatedReport).
   */
  async findConsolidadoGuardador(args: IFindPublicacaoRelatorio): Promise<RelatorioConsolidadoResultDto[]> {
    if (args.dataInicio === undefined || args.dataFim === undefined || new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    const statusToFetch = this.resolveStatus(args);

    const results = await Promise.all(
      statusToFetch.map((status) => this.instanceDataGuardadorConsolidado(args, status)),
    );

    return results;
  }

  /**
   * Gerar relatórios consolidados para Guardadores no formato Novo Remessa (espelhando permissionários).
   */
  async findConsolidadoGuardadorNovoRemessa(args: IFindPublicacaoRelatorioNovoRemessa) {
    if (args.dataInicio === undefined || args.dataFim === undefined || new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioGuardadorConsolidadoRepository.findConsolidadoNovoRemessa(args);
  }

  private async instanceDataGuardadorConsolidado(
    args: IFindPublicacaoRelatorio,
    status: string,
  ): Promise<RelatorioConsolidadoResultDto> {
    // The repository lets specific flags override `status`, so each block must carry
    // only its own status or it would also return the rows of the other blocks.
    const { pendenciaPaga, ...argsWithoutPendenciaPaga } = args;
    const blockArgs = status === 'pendenciaPaga'
      ? {
        ...argsWithoutPendenciaPaga,
        pago: undefined,
        aPagar: undefined,
        emProcessamento: undefined,
        rejeitado: undefined,
        estorno: undefined,
        pendenciaPaga: true,
      }
      : { ...argsWithoutPendenciaPaga, status };

    const data = await this.relatorioGuardadorConsolidadoRepository.findConsolidado(blockArgs as any);

    const result = new RelatorioConsolidadoResultDto();
    result.count = data.length;
    result.data = data;
    result.valor = +data.reduce((s, i) => s + (Number(i.valor) || 0), 0).toFixed(2);
    result.status = status;
    return result;
  }

  private resolveStatus(args: IFindPublicacaoRelatorio): string[] {
    const hasFiltroEspecifico = Boolean(
      args.userIds?.length || args.favorecidoNome?.length || args.consorcioNome?.length || args.todosConsorcios,
    );

    const pendenciaPaga = args.pendenciaPaga === true ? ['pendenciaPaga'] : [];

    if (!hasFiltroEspecifico && args.pago === undefined && args.aPagar === undefined && !pendenciaPaga.length) {
      return ['todos', 'pago', 'erros', 'aPagar'];
    }
    if (args.pago === true && args.aPagar === true) {
      return ['pago', 'aPagar', ...pendenciaPaga];
    }
    if (args.pago === true) return ['pago', ...pendenciaPaga];
    if (args.pago === false) return ['erros', ...pendenciaPaga];
    if (args.aPagar === true) return ['aPagar', ...pendenciaPaga];

    return pendenciaPaga.length ? pendenciaPaga : ['todos'];
  }

  async findMovimentacaoFinanceira(args: IFindPublicacaoRelatorioNovoRemessa) {
    if (args.dataInicio === undefined || args.dataFim === undefined || new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioNovoRemessaMovimentacaoRepository.findMovimentacao(args);
  }

  async findMovimentacaoFinanceiraGuardador(args: IFindPublicacaoRelatorioNovoFinancialMovement) {
    if (args.dataInicio === undefined || args.dataFim === undefined || new Date(args.dataFim) < new Date(args.dataInicio)) {
      throw new Error('Parametro de data inválido');
    }

    return this.relatorioGuardadorFinancialMovementRepository.findFinancialMovementPage(args);
  }

  async findExtrato(args: IFindExtrato){
    if(args.dataInicio ===undefined || args.dataFim === undefined || 
      new Date(args.dataFim) < new Date(args.dataInicio)){
      throw new Error('Parametro de data inválido');
    }   

    const extrato = await this.relatorioExtratoRepository.findExtrato(args)

    const response  = new RelatorioExtratoBancarioResponseDto();

    response.extrato = extrato;

    response.saldoConta = extrato[extrato.length - 1]?.valorSaldoInicial ?? 0;

    return response;
  }
}
