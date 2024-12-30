import { StatusRemessaEnum } from '../../enums/novo-remessa/status-remessa.enum';
import { OcorrenciaEnum } from '../../enums/ocorrencia.enum';

export class OrdemPagamentoAgrupadoMensalDto {
  data: Date;
  valorTotal: number | undefined;
  statusRemessa: StatusRemessaEnum | undefined;
  motivoStatusRemessa: OcorrenciaEnum | undefined;
  descricaoStatusRemessa: string | undefined;
  descricaoMotivoStatusRemessa: string | undefined;
}