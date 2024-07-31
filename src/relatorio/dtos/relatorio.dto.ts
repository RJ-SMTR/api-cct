import { Exclude } from 'class-transformer';
import { ArquivoPublicacao } from 'src/cnab/entity/arquivo-publicacao.entity';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';
import { OcorrenciaRelatorio } from './ocorrencia-relatorio.dto';

export class RelatorioDto {
  constructor(relatorio?: DeepPartial<RelatorioDto>) {
    if (relatorio !== undefined) {
      Object.assign(this, relatorio);

      if (relatorio?.ocorrencias) {
        this.ocorrencias = OcorrenciaRelatorio.joinUniqueCode(relatorio.ocorrencias.map((o) => new OcorrenciaRelatorio({ ...o })));
        this.isErro = this.getIsErro();
        this.ocorrencias = this.ocorrencias.map((o) => (o));
      }
      if (relatorio?.valor) {
        this.valor = +relatorio.valor;
      }
      if (relatorio?.valorRealEfetivado) {
        this.valorRealEfetivado = +relatorio.valorRealEfetivado;
      }
    }
  }
  dataOrdem: Date;
  /** Data de criação do ItemTransacao */
  dataCriacaoOrdem: Date;
  /** Valor bruto a pagar */
  @SetValue((v: number) => (v == null ? null : +v.toFixed(2)))
  valor: number;
  @SetValue((v: number) => (v == null ? null : +v.toFixed(2)))
  valorRealEfetivado: number | null;
  isPago: boolean;
  isErro: boolean;
  isPendente: boolean;
  ocorrencias: OcorrenciaRelatorio[];
  nomeFavorecido: string;
  nomeConsorcio: string;
  cpfCnpj: string;

  /** Agrupar por favorecido */
  @Exclude()
  clienteFavorecidoId: number;

  /** Debug */
  @Exclude()
  itemTransacaoId: number;

  /** Debug */
  @Exclude()
  itemTransacaoAgrupadoId: number;

  private getIsErro() {
    const ocorrenciasUnique = this.ocorrencias.reduce((l, o) => OcorrenciaRelatorio.joinUniqueCode(l, [o]), []);
    const errors = Ocorrencia.getErrorCodes(ocorrenciasUnique.filter(o => o.ocorrencia).map((o) => o.ocorrencia as Ocorrencia));
    const isErro = errors.length > 0;
    return isErro;
  }
}
