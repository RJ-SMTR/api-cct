import { EntityHelper } from 'src/utils/entity-helper';
import {  Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrdemPagamentoEntity } from './ordens-pagamento.entity';

@Entity()
export class OrdemPagamentoAgrupadoEntity extends EntityHelper {
  constructor(dto?: DeepPartial<OrdemPagamentoAgrupadoEntity>) {
    super();
    if (dto) {
      Object.assign(this, dto);      
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_Ordem_Pagamento_Agrupado_id' })
  id: number;  
  
  @Column({ type: String, unique: false, nullable: false })
  userId: number;

  @Column({ type: String, unique: false, nullable: false })
  userBankCode: string;

  @Column({ type: String, unique: false, nullable: false })
  userBankAgency: string;

  @Column({ type: String, unique: false, nullable: false })
  userBankAccount: string;

  @CreateDateColumn()
  dataPagamento: Date;

  @Column({
    type: 'decimal',
    unique: false,
    nullable: true,
    precision: 13,
    scale: 5,
  })
  ValorTotal: number;

  @Column({ type: String, unique: false, nullable: false })
  ordensPagamento: OrdemPagamentoEntity[];  

  @Column({ type: String, unique: false, nullable: false })
  statusRemessa: string; 
  
  @Column({type: Boolean, unique: false, nullable: true})
  isPago: boolean;  

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;  
}