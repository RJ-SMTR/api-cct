import { Exclude } from 'class-transformer';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';
import { OcorrenciaRelatorio } from './ocorrencia-relatorio.dto';
import { RelatorioDto } from './relatorio.dto';

export class RelatorioConsolidadoDto {
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
      if (consolidado.ocorrencias) {
        this.ocorrencias = OcorrenciaRelatorio.joinUniqueCode(consolidado.ocorrencias.map((o) => new OcorrenciaRelatorio(o)));
      }
    }
  }
  valor: number = 0;
  valorRealEfetivado: number | null;
  pagoCount: number = 0;
  erroCount: number = 0;
  ocorrencias: OcorrenciaRelatorio[];
  nome: String;
  // cpfCnpj: string;

  @Exclude()
  clienteFavorecidoId: number;

  count: number = 1;

  /** Valor apenas com itens pagos */
  valorErro: number = 0;

  /** Valor apenas com itens pagos */
  valorPago: number = 0;

  /** Valor apenas com itens não pagos */
  valorPendente: number = 0;

  public static fromRelatorios(relatorios: RelatorioDto[]) {
    const consolidados: RelatorioConsolidadoDto[] = [];
    for (const relatorio of relatorios) {
      const group = consolidados.find((c) => c.clienteFavorecidoId === relatorio.clienteFavorecidoId);
      if (group) {
        group.valor = +group.valor + +relatorio.valor || 0;
        if (relatorio.isPago) {
          group.valorPago += relatorio.valor;
          group.pagoCount += 1;
        }
        if (relatorio.isErro) {
          group.erroCount += 1;
          group.valorErro += relatorio.valor;
        }
        group.ocorrencias = OcorrenciaRelatorio.joinUniqueCode(group.ocorrencias, relatorio.ocorrencias);
        group.count += 1;
      } else {
        consolidados.push(
          new RelatorioConsolidadoDto({
            // dataCriacaoOrdem: relatorio.dataCriacaoOrdem,
            // dataOrdem: relatorio.dataOrdem,
            erroCount: relatorio.isErro ? 1 : 0,
            pagoCount: relatorio.isPago ? 1 : 0,
            ocorrencias: relatorio.ocorrencias,
            valor: relatorio.valor,
            valorRealEfetivado: relatorio.valorRealEfetivado,
            clienteFavorecidoId: relatorio.clienteFavorecidoId,
            // nome: relatorio.nome,
            // cpfCnpj: relatorio.cpfCnpj,
            valorErro: relatorio.isErro ? relatorio.valor : 0,
            valorPago: relatorio.isPago ? relatorio.valor : 0,
            // pendenteCount: relatorio.isPendente ? 1 : 0,
            valorPendente: relatorio.isPendente ? relatorio.valor : 0,
          }),
        );
      }
    }
    return consolidados;
  }
}
