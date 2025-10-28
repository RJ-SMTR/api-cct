import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrdemPagamentoAgrupado } from './ordem-pagamento-agrupado.entity';
import { StatusRemessaEnum } from 'src/cnab/enums/novo-remessa/status-remessa.enum';
import { OcorrenciaEnum } from 'src/cnab/enums/ocorrencia.enum';

@Entity()
export class OrdemPagamentoAgrupadoHistorico extends EntityHelper {
  constructor(dto?: DeepPartial<OrdemPagamentoAgrupadoHistorico>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_OrdemPagamentoAgrupadoHistoricoId' })
  id: number;
  
  @Column({ type: Date, unique: false, nullable: false })
  dataReferencia: Date;

  @Column({ type: String, unique: false, nullable: false })
  userBankCode: string;

  @Column({ type: String, unique: false, nullable: false })
  userBankAgency: string;

  @Column({ type: String, unique: false, nullable: false })
  userBankAccount: string;

  @Column({ type: String, unique: false, nullable: false })
  userBankAccountDigit: string;  

  @Column({ enum: StatusRemessaEnum, unique: false, nullable: false })
  statusRemessa: StatusRemessaEnum; 

  @Column({ enum: OcorrenciaEnum, unique: false, nullable: true })
  motivoStatusRemessa?: OcorrenciaEnum;  
  
  @ManyToOne(() => OrdemPagamentoAgrupado, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_OrdemPagamentoAgrupadoHistorico_ordensPagamento_OneToMany' })
  ordemPagamentoAgrupado: OrdemPagamentoAgrupado; 

}