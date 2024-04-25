import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrDateTime } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { HeaderArquivoStatus } from './header-arquivo-status.entity';
import { Transacao } from './transacao.entity';

/**
 * Pagamento.HeaderArquivo
 */
@Entity()
export class HeaderArquivo extends EntityHelper {
  constructor(dto?: DeepPartial<HeaderArquivo>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_HeaderArquivo_id' })
  id: number;

  @Column({ type: Number, unique: false, nullable: false })
  tipoArquivo: number;

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

  @Column({ type: Date, unique: false, nullable: true })
  dataGeracao: Date;

  @Column({ type: 'time', unique: false, nullable: true })
  horaGeracao: Date;

  @ManyToOne(() => Transacao, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_HeaderArquivo_transacao_ManyToOne' })
  transacao: Transacao;

  @Column({ type: Number, unique: false, nullable: false })
  nsa: number;

  @ManyToOne(() => HeaderArquivoStatus, { eager: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_HeaderArquivo_status_ManyToOne' })
  status: HeaderArquivoStatus;

  @CreateDateColumn()
  createdAt: Date;

  public getIdString(): string {
    return `{ transacao: ${this.transacao.id}, nsa: ${this.nsa}, tipoArquivo: ${this.tipoArquivo}}`;
  }

  @AfterLoad()
  setFieldValues() {
    this.horaGeracao = asStringOrDateTime(this.horaGeracao, this.dataGeracao);
  }

  public static getUniqueId(item?: DeepPartial<HeaderArquivo>) {
    return `${item?.nsa}|${item?.tipoArquivo}`;
  }
}
