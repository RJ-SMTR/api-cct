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
import { TransacaoAgrupado } from './transacao-agrupado.entity';

/**
 * Pagamento.HeaderArquivo
 */
@Entity()
export class HeaderArquivo extends EntityHelper {
  constructor(dto?: DeepPartial<HeaderArquivo>) {
    super();
    if (dto) {
      Object.assign(this, dto);
      if (dto.dataGeracao) {
        this.dataGeracao = new Date(this.dataGeracao);
      }
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_HeaderArquivo_id' })
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
  dvAgencia: string ;

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
 

  @ManyToOne(() => TransacaoAgrupado, { eager: true })
  @JoinColumn({
    foreignKeyConstraintName: 'FK_HeaderArquivo_transacaoAgrupado_ManyToOne',
  })
  transacaoAgrupado: TransacaoAgrupado | null;

  @Column({ type: Number, unique: false, nullable: false })
  nsa: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
  

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

  public static getUniqueId(item?: DeepPartial<HeaderArquivo>) {
    return `${item?.nsa}|${item?.tipoArquivo}`;
  }
}
