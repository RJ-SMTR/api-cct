import { Exclude } from 'class-transformer';
import { SetValue } from 'src/utils/decorators/set-value.decorator';
import { DeepPartial } from 'typeorm';

export class RelatorioSinteticoNovoRemessaDto {
  constructor(sintetico?: DeepPartial<RelatorioSinteticoNovoRemessaDto>) {
    if (sintetico !== undefined) {
      Object.assign(this, sintetico);
    }
  }

  count: number;
  total: number;
  agrupamentoConsorcio: RelatorioSinteticoNovoRemessaConsorcio[];

}

export class RelatorioSinteticoNovoRemessaConsorcio {
  constructor(sintetico?: DeepPartial<RelatorioSinteticoNovoRemessaConsorcio>) {
    if (sintetico !== undefined) {
      Object.assign(this, sintetico);
    }
  }
  subtotalConsorcio: number;
  agrupamentoFavorecido: RelatorioSinteticoNovoRemessaFavorecido[];
}

export class RelatorioSinteticoNovoRemessaFavorecido {
  constructor(sintetico?: DeepPartial<RelatorioSinteticoNovoRemessaFavorecido>) {
    if (sintetico !== undefined) {
      Object.assign(this, sintetico);
    }
  }
  subtotalFavorecido: number;
  agrupamentoDia: RelatorioSinteticoNovoRemessaDia[];
}


export class RelatorioSinteticoNovoRemessaDia {
  constructor(sintetico?: DeepPartial<RelatorioSinteticoNovoRemessaDia>) {
    if (sintetico !== undefined) {
      Object.assign(this, sintetico);
    }
  }
  consorcio: string;
  valor: number;
  favorecido: string;
  cpfCnpj: string;
  status: string;
  mensagemStatus: string;
  dataPagamento: string;
}

