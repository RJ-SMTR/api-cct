import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Pagador extends EntityHelper {
  constructor(pagador?: Pagador | DeepPartial<Pagador>) {
    super();
    if (pagador !== undefined) {
      Object.assign(this, pagador);
    }
  }

  @PrimaryGeneratedColumn({primaryKeyConstraintName: 'PK_Pagador_id'})
  id: number;

  @Column({ type: String, unique: false, nullable: false, length: 150 })
  nomeEmpresa: string;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  agencia: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dvAgencia: string;

  @Column({ type: String, unique: false, nullable: true, length: 12 })
  conta: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dvConta: string;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  logradouro: string;

  @Column({ type: String, unique: false, nullable: true, length: 15 })
  numero: string;

  @Column({ type: String, unique: false, nullable: true, length: 100 })
  complemento: string;

  @Column({ type: String, unique: false, nullable: true, length: 150 })
  bairro: string;

  @Column({ type: String, unique: false, nullable: true, length: 150 })
  cidade: string;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  cep: string;

  @Column({ type: String, unique: false, nullable: true, length: 3 })
  complementoCep: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  uf: string;

  @Column({ type: String, unique: false, nullable: true, length: 14 })
  cpfCnpj: string;

  public getLogInfo(): string {
    const response =
      `#${this.id}` + ` '${this.nomeEmpresa.substring(0, 10)}...'`;
    return response;
  }
}
