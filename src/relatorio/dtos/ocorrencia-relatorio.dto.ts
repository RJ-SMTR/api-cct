import { Exclude } from 'class-transformer';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { Enum } from 'src/utils/enum';
import { DeepPartial } from 'typeorm';

export interface IOcorrenciaRelatorio {
  ocorrencia: DeepPartial<Ocorrencia>;
  code: string | null;
  valor: number;
}

export class OcorrenciaRelatorio {
  constructor(ocorrencia?: IOcorrenciaRelatorio) {
    if (ocorrencia) {
      Object.assign(this, ocorrencia);
      if (ocorrencia.ocorrencia) {
        const code = ocorrencia.ocorrencia.code;
        this.ocorrencia = new Ocorrencia({
          ...ocorrencia.ocorrencia,
          ...(code ? { message: OcorrenciaEnum[code] } : {}),
        });
      }
      this.valor = +this.valor;
    }
  }

  ocorrencia: Ocorrencia | null;

  /** Valor total da ocorrencia */
  @SetValue((v: number) => (v == null ? null : +v.toFixed(2)))
  valor: number;

  count: number = 1;

  /**
   * De duas OcorrenciaRelatorios, agrupa por codigoOcorrencia
   */
  public static joinUniqueCode(old: OcorrenciaRelatorio[], inserted: OcorrenciaRelatorio[] = []) {
    const joined: OcorrenciaRelatorio[] = [];
    for (const ocorrencia of [...old, ...inserted]) {
      const found = joined.find((i) => i.ocorrencia?.code === ocorrencia.ocorrencia?.code);
      if (!found) {
        joined.push(ocorrencia);
      } else {
        found.valor += ocorrencia.valor;
        found.count += 1;
      }
    }
    return joined;
  }
}
