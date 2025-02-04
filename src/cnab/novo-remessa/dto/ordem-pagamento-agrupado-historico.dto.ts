import {  DeepPartial   } from 'typeorm';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';

export class OrdemPagamentoAgrupadoHistoricoDTO{

  constructor(dto?: DeepPartial<OrdemPagamentoAgrupadoHistoricoDTO>) {
     if (dto) {
      Object.assign(this, dto);
    }
  }

  id: number;
  
  dataReferencia: Date;

  username: string;

  usercpfcnpj: string;

  userBankCode: string;

  userBankAgency: string;

  userBankAccount: string;

  userBankAccountDigit: string;  

  statusRemessa: StatusRemessaEnum; 

  motivoStatusRemessa: OcorrenciaEnum;  
  
  ordemPagamentoAgrupadoId: Number;

}