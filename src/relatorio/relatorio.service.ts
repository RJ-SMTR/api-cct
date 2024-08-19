import { Injectable } from '@nestjs/common';
import { IFindPublicacaoRelatorio } from './interfaces/find-publicacao-relatorio.interface';
import { RelatorioRepository } from './relatorio.repository';

@Injectable()
export class RelatorioService {
  constructor(private relatorioRepository: RelatorioRepository) {}

  /**
   * Gerar relatórios consolidados - agrupados por Favorecido.
   */
  async findConsolidado(args: IFindPublicacaoRelatorio) {
    const consolidados = await this.relatorioRepository.findConsolidado(args);
    const d = 3;
    return  {
      count: consolidados.length,
      valor: +consolidados.reduce((s, i) => s + i.valor, 0).toFixed(d),      
      data: consolidados      
    };
  }
}