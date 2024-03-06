import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('Cliente_Favorecido')
export class ClienteFavorecido extends EntityHelper {
  constructor(
    clienteFavorecido?: ClienteFavorecido | DeepPartial<ClienteFavorecido>,
  ) {
    super();
    if (clienteFavorecido !== undefined) {
      Object.assign(this, clienteFavorecido);
    }
  }

  @PrimaryGeneratedColumn()
  id_cliente_favorecido: number;

  @Column({ type: String, unique: false, nullable: false, length: 150 })
  nome: string;

  @Column({ type: String, unique: false, nullable: true, length: 14 })
  cpf_cnpj: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 10 })
  cod_banco: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  agencia: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dv_agencia: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 12 })
  conta_corrente: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dv_conta_corrente: string | null;

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
  complemento_cep: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  uf: string | null;

  public getLogInfo(showName?: boolean): string {
    if (showName === undefined) {
      showName = false;
    }
    const response = `#${this.cpf_cnpj}` + showName ? ` '${this.nome}'` : '';
    return response;
  }
}