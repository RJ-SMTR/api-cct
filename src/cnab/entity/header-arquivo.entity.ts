import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class HeaderArquivo extends EntityHelper {
  @PrimaryGeneratedColumn()
  id_header_arquivo: number;
  @Column({ type: String, unique: false, nullable: true })
  nsa: string;
  @Column({ type: String, unique: false, nullable: true })
  tipo_arquivo: string;
  @Column({ type: String, unique: false, nullable: true })
  cod_banco: string;
  @Column({ type: String, unique: false, nullable: true })
  tipo_inscricao: string;
  @Column({ type: String, unique: false, nullable: true })
  num_inscricao: string;
  @Column({ type: String, unique: false, nullable: true })
  cod_convenio: string;
  @Column({ type: String, unique: false, nullable: true })
  param_transmissao: string;
  @Column({ type: String, unique: false, nullable: true })
  agencia: string;
  @Column({ type: String, unique: false, nullable: true })
  dv_agencia: string;
  @Column({ type: String, unique: false, nullable: true })
  num_conta: string;
  @Column({ type: String, unique: false, nullable: true })
  dv_conta: string;
  @Column({ type: String, unique: false, nullable: true })
  nome_empresa: string;
  @Column({ type: String, unique: false, nullable: true })
  dt_geracao: Date;
  @Column({ type: String, unique: false, nullable: true })
  hr_geracao: Date;
  @Column({ type: Number, unique: false, nullable: true })
  id_transacao: number;
  @CreateDateColumn()
  createdAt: Date;
}
