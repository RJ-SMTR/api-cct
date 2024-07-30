import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';

export class OcorrenciaRelatorio {
  constructor(ocorrencia?: DeepPartial<OcorrenciaRelatorio>) {
    if (ocorrencia !== undefined) {
      Object.assign(this, ocorrencia);
      if (ocorrencia?.ocorrencia) {
        this.ocorrencia = new Ocorrencia(ocorrencia.ocorrencia);
      }
    }
  }
  ocorrencia: Ocorrencia;

  /** Valor total da ocorrencia */
  @SetValue((v: number) => (v == null ? null : +v.toFixed(2)))
  valor: string;

  count: number = 1;

  _arquivoPublicacaoId?: number;
  _arquivoPublicacaoIds: number[] = [];
  _pagoCount: number = 0;
  _pendenteCount: number = 0;
  _erroCount: number = 0;

  /**
   * De duas OcorrenciaRelatorios, agrupa por codigoOcorrencia
   */
  public static joinUniqueCode(
    old: OcorrenciaRelatorio[],
    inserted: OcorrenciaRelatorio[] = [],
  ) {
    const joined: OcorrenciaRelatorio[] = [];
    for (const ocorrencia of [...old, ...inserted]) {
      const found = joined.find(
        (i) => i.ocorrencia.code === ocorrencia.ocorrencia.code,
      );
      const detalheAId = found?.ocorrencia?.detalheA?.id;
      const publicacaoId = ocorrencia._arquivoPublicacaoId;
      // Se for grupo novo, adiciona
      if (!found) {
        joined.push(ocorrencia);
      }
      // Se for um detalheA com a mesma ocorrência, porém com detalheAID diferente, incrementa
      else if (
        detalheAId &&
        detalheAId !== ocorrencia?.ocorrencia?.detalheA?.id
      ) {
        found.valor += ocorrencia.valor;
        found.count += 1;
        // Publicacoes agrupadas na OcorrenciaRelatorio
        if (publicacaoId) {
          found._arquivoPublicacaoIds.push(publicacaoId);
        }
        found._erroCount += ocorrencia._erroCount;
        found._pagoCount += ocorrencia._pagoCount;
        found._pendenteCount;
      }
    }
    return joined;
  }
}
