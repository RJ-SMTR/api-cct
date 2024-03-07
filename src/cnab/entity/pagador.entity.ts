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

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: String, unique: false, nullable: false, length: 150 })
  nomeEmpresa: string;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  agencia: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dvAgencia: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 12 })
  conta: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dvConta: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 200 })
  logradouro: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 15 })
  numero: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 100 })
  complemento: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 150 })
  bairro: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 150 })
  cidade: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  cep: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 3 })
  complementoCep: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  uf: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  cpfCnpj: string | null;

  public getLogInfo(): string {
    const response =
      `#${this.id}` + ` '${this.nomeEmpresa.substring(0, 10)}...'`;
    return response;
  }
}
