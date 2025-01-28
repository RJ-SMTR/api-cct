import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';
import { OrdemPagamentoAgrupado } from '../entity/ordem-pagamento-agrupado.entity';

@Entity()
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