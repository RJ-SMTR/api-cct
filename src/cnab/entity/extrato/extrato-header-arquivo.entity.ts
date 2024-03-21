import { EntityHelper } from 'src/utils/entity-helper';
import { asNullableStringOrDateTime } from 'src/utils/pipe-utils';
import { AfterLoad, Column, CreateDateColumn, DeepPartial, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ExtratoHeaderArquivo extends EntityHelper {
  constructor(dto?: DeepPartial<ExtratoHeaderArquivo>) {
    super();
    if (dto) {
      Object.assign(this, dto);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_ExtratoHeaderArquivo_id' })
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

  @Column({ type: Number, unique: false, nullable: false })
  nsa: number;

  @CreateDateColumn()
  createdAt: Date;

  /**
   * For some reason, fields like 'time', 'decimal'
   * are received as string instead as Date, Number
   */
  @AfterLoad()
  castFields() {
    this.horaGeracao = asNullableStringOrDateTime(this.horaGeracao, this.dataGeracao);
  }
}
