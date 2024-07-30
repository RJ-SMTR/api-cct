import { Injectable } from '@nestjs/common';
import { RelatorioConsolidadoDto } from './dtos/relatorio-consolidado.dto';
import { RelatorioDto } from './dtos/relatorio.dto';
import { IFilterRelatorio } from './interfaces/filter-relatorio.interface';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioRepository } from './relatorio.repository';

@Injectable()
export class RelatorioService {
  constructor(
    private relatorioRepository: RelatorioRepository,
  ) {}

  /**
   * Gerar relatórios consolidados - agrupados por Favorecido.
   */
  async findConsolidado(args: IFindPublicacaoRelatorio) {
    let relatorios = await this.relatorioRepository.find(args);
    relatorios = this.filterRelatorios(relatorios, args);
    const consolidados = RelatorioConsolidadoDto.fromRelatorios(relatorios);
    return {
      count: consolidados.length,
      data: consolidados,
    };
  }

  /**
   * Após montar o relatório, executar filtros znão feitos no SQL
   */
  private filterRelatorios(
    relatorios: RelatorioDto[],
    filter: IFilterRelatorio,
  ) {
    return relatorios.filter((r) => {
      const filterErro = filter?.erro === undefined || filter.erro == r.isErro;
      // const filterPago = filter?.pago === undefined || filter.pago == r.isPago;
      // const filterOcorrenciaCodigo =
      //   !filter?.ocorrenciaCodigo?.length ||
      //   r.ocorrencias.filter((o) => filter.ocorrenciaCodigo?.includes(o.ocorrencia.code))
      //     .length > 0;
      return filterErro;
    });
  }
}
