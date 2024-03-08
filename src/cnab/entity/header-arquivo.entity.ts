import { EntityHelper } from 'src/utils/entity-helper';
import { Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Transacao } from './transacao.entity';

@Entity()
export class HeaderArquivo extends EntityHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String, unique: false, nullable: true, length: 100 })
  tipoArquivo: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 10 })
  codigoBanco: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  tipoInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 14 })
  numeroInscricao: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 6 })
  codigoConvenio: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  parametroTransmissao: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  agencia: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 1 })
  dvAgencia: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 12 })
  numeroConta: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 1 })
  dvConta: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 100 })
  nomeEmpresa: string | null;

  @Column({ type: String, unique: false, nullable: true })
  dataGeracao: Date | null;

  @Column({ type: 'time', unique: false, nullable: true })
  horaGeracao: Date | null;

  @OneToOne(() => Transacao, { eager: true })
  transacao: Transacao;

  @Column({ type: Number, unique: true, nullable: false })
  nsa: number;

  @CreateDateColumn()
  createdAt: Date;
}
