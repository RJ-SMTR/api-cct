import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ClienteFavorecido extends EntityHelper {
  constructor(
    clienteFavorecido?: DeepPartial<ClienteFavorecido>,
  ) {
    super();
    if (clienteFavorecido !== undefined) {
      Object.assign(this, clienteFavorecido);
    }
  }

  @PrimaryGeneratedColumn({ primaryKeyConstraintName: 'PK_ClienteFavorecido_id' })
  id: number;

  @Column({ type: String, unique: false, nullable: false, length: 150 })
  nome: string;

  /** uniqueConstraintName: UQ_ClienteFavorecido_cpfCnpj */
  @Column({ type: String, unique: true, nullable: true, length: 14 })
  cpfCnpj: string;

  @Column({ type: String, unique: false, nullable: true, length: 10 })
  codigoBanco: string;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  agencia: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dvAgencia: string;

  @Column({ type: String, unique: false, nullable: true, length: 12 })
  contaCorrente: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dvContaCorrente: string;

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
  
  @Column({ type: String, unique: false, nullable: true })
  tipo: string | null;

  public getLogInfo(showName?: boolean): string {
    if (showName === undefined) {
      showName = false;
    }
    const response = `#${this.cpfCnpj}` + showName ? ` '${this.nome}'` : '';
    return response;
  }
}
