import { EntityHelper } from 'src/utils/entity-helper';
import { asStringOrDateTime } from 'src/utils/pipe-utils';
import {
  AfterLoad,
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeepPartial,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transacao } from '../pagamento/transacao.entity';
import { TransacaoAgrupado } from '../pagamento/transacao-agrupado.entity';


/**
 * Pagamento.HeaderArquivo
 */
@Entity()
export class HeaderArquivoConf extends EntityHelper {
  constructor(dto?: DeepPartial<HeaderArquivoConf>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_HeaderArquivoConf_id' })
  id: number;

  @Column({ type: Number, unique: false, nullable: false })
  tipoArquivo: number;

  @Column({ type: String, unique: false, nullable: true, length: 3 })
  codigoBanco: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  tipoInscricao: string;

  @Column({ type: String, unique: false, nullable: true, length: 14 })
  numeroInscricao: string;

  @Column({ type: String, unique: false, nullable: true, length: 6 })
  codigoConvenio: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  parametroTransmissao: string;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  agencia: string;

  @Column({ type: String, unique: false, nullable: true, length: 1 })
  dvAgencia: string;

  @Column({ type: String, unique: false, nullable: true, length: 12 })
  numeroConta: string;

  @Column({ type: String, unique: false, nullable: true, length: 1 })
  dvConta: string;

  @Column({ type: String, unique: false, nullable: true, length: 100 })
  nomeEmpresa: string;

  @Column({ type: Date, unique: false, nullable: true })
  dataGeracao: Date;

  @Column({ type: 'time', unique: false, nullable: true })
  horaGeracao: Date;

  @ManyToOne(() => Transacao, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_HeaderArquivoConf_transacao_ManyToOne',
  })
  transacao: Transacao | null;

  @ManyToOne(() => TransacaoAgrupado, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_HeaderArquivoConf_transacaoAgrupado_ManyToOne',
  })
  transacaoAgrupado: TransacaoAgrupado | null;

  @Column({ type: Number, unique: false, nullable: false })
  nsa: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  public getIdString(): string {
    return `{ transacao: ${this.transacao?.id},  transacaoAg: ${this.transacaoAgrupado?.id}, nsa: ${this.nsa}, tipoArquivo: ${this.tipoArquivo}}`;
  }

  @BeforeInsert()
  setLoadValues() {
    if (typeof this.codigoBanco === 'string') {
      this.codigoBanco = this.codigoBanco.padStart(3, '0');
    }
    if (typeof this.numeroConta === 'string') {
      this.numeroConta = this.numeroConta.padStart(12, '0');
    }
  }

  @AfterLoad()
  setReadValues() {
    this.horaGeracao = asStringOrDateTime(this.horaGeracao, this.dataGeracao);
  }

  public static getUniqueId(item?: DeepPartial<HeaderArquivoConf>) {
    return `${item?.nsa}|${item?.tipoArquivo}`;
  }
}
