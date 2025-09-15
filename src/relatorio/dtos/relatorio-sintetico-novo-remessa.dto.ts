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
  nomeConsorcio: string;
  agrupamentoFavorecido: RelatorioSinteticoNovoRemessaFavorecido[];
  totalsByStatus: {
    pago: 0,
    erro: 0
  }
}

export class RelatorioSinteticoNovoRemessaFavorecido {
  constructor(sintetico?: DeepPartial<RelatorioSinteticoNovoRemessaFavorecido>) {
    if (sintetico !== undefined) {
      Object.assign(this, sintetico);
    }
  }
  subtotalFavorecido: number;
  nomeFavorecido: string;
  agrupamentoDia: RelatorioSinteticoNovoRemessaDia[];
}


export class RelatorioSinteticoNovoRemessaDia {
  constructor(sintetico?: DeepPartial<RelatorioSinteticoNovoRemessaDia>) {
    if (sintetico !== undefined) {
      Object.assign(this, sintetico);
    }
  }
  userId: number;
  dataCaptura: string;
  nomeFavorecido: string;
  dataPagamento: string;
  valorPagamento: number;
  status: string;
  nomeConsorcio: string;
}

