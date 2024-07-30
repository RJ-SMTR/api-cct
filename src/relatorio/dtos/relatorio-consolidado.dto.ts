import { Exclude } from 'class-transformer';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';
import { RelatorioDto } from './relatorio.dto';
import { SetValueIf } from 'src/utils/decorators/set-value-if.decorator';
import { OcorrenciaRelatorio } from './ocorrencia-relatorio.dto';

export class RelatorioConsolidadoDto {
  constructor(consolidado?: DeepPartial<RelatorioConsolidadoDto>) {
    if (consolidado !== undefined) {
      Object.assign(this, consolidado);
    }
  }
  dataOrdem: Date;
  /** Data de criação do ItemTransacao */
  dataCriacaoOrdem: Date;
  /** Valor bruto a pagar */
  @SetValue((v: number) => +v.toFixed(2))
  valor: number = 0;
  @SetValue((v: number) => (v == null ? null : +v.toFixed(2)))
  valorRealEfetivado: number | null;
  pagoCount: number = 0;
  erroCount: number = 0;
  pendenteCount: number = 0;
  ocorrencias: OcorrenciaRelatorio[];
  nomeFavorecido: String;
  cpfCnpj: string;

  @Exclude()
  clienteFavorecidoId: number;

  count: number = 1;

  /** Valor apenas com itens pagos */
  @SetValue((v: number) => (v == null ? null : +v.toFixed(2)))
  valorErro: number = 0;

  /** Valor apenas com itens pagos */
  @SetValue((v: number) => (v == null ? null : +v.toFixed(2)))
  valorPago: number = 0;

  /** Valor apenas com itens não pagos */
  @SetValue((v: number) => (v == null ? null : +v.toFixed(2)))
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
        if (relatorio.isPendente) {
          group.pendenteCount += 1;
          group.valorPendente += relatorio.valor;
        }
        group.ocorrencias = OcorrenciaRelatorio.joinUniqueCode(group.ocorrencias, relatorio.ocorrencias);
        group.count += 1;
      } else {
        consolidados.push(
          new RelatorioConsolidadoDto({
            dataCriacaoOrdem: relatorio.dataCriacaoOrdem,
            dataOrdem: relatorio.dataOrdem,
            erroCount: relatorio.isErro ? 1 : 0,
            pagoCount: relatorio.isPago ? 1 : 0,
            ocorrencias: relatorio.ocorrencias,
            valor: relatorio.valor,
            valorRealEfetivado: relatorio.valorRealEfetivado,
            clienteFavorecidoId: relatorio.clienteFavorecidoId,
            nomeFavorecido: relatorio.nomeFavorecido,
            cpfCnpj: relatorio.cpfCnpj,
            valorErro: relatorio.isErro ? relatorio.valor : 0,
            valorPago: relatorio.isPago ? relatorio.valor : 0,
            pendenteCount: relatorio.isPendente ? 1 : 0,
            valorPendente: relatorio.isPendente ? relatorio.valor : 0,
          }),
        );
      }
    }
    return consolidados;
  }
}
