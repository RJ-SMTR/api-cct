import { EntityHelper } from 'src/utils/entity-helper';
import { asNullableStringOrDateTime } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Transacao } from './transacao.entity';

@Entity()
export class HeaderArquivo extends EntityHelper {
  constructor(dto?: DeepPartial<HeaderArquivo>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: Number, unique: false, nullable: true })
  tipoArquivo: number | null;

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
  dataGeracao: Date | null;

  @Column({ type: 'time', unique: false, nullable: true })
  horaGeracao: Date | null;

  @ManyToOne(() => Transacao, { eager: true })
  transacao: Transacao;

  @Column({ type: Number, unique: false, nullable: false })
  nsa: number;

  @CreateDateColumn()
  createdAt: Date;

  public getComposedPKLog(): string {
    return `{ transacao: ${this.transacao.id}, nsa: ${this.nsa}, tipoArquivo: ${this.tipoArquivo}}`;
  }

  /**
   * For some reason, fields like 'time', 'decimal'
   * are received as string instead as Date, Number
   */
  @AfterLoad()
  castFields() {
    this.horaGeracao = asNullableStringOrDateTime(this.horaGeracao, this.dataGeracao);
  }
}
