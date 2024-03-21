import { PermissionarioRole } from 'src/permissionario-role/permissionario-role.entity';
import { User } from 'src/users/entities/user.entity';
import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class ClienteFavorecido extends EntityHelper {
  constructor(
    clienteFavorecido?: ClienteFavorecido | DeepPartial<ClienteFavorecido>,
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

  @Column({ type: String, unique: false, nullable: true, length: 14 })
  cpfCnpj: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 10 })
  codigoBanco: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  agencia: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dvAgencia: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 12 })
  contaCorrente: string | null;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dvContaCorrente: string | null;

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

  @ManyToOne(() => PermissionarioRole, { eager: true, nullable: true })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ClienteFavorecido_permissionarioRole_ManyToOne' })
  permissionarioRole: PermissionarioRole | null;

  /** Just for maintenance and audit control */
  @OneToOne(() => User, { eager: false })
  @JoinColumn({ foreignKeyConstraintName: 'FK_ClienteFavorecido_user_OneToOne' })
  user: User;

  public getLogInfo(showName?: boolean): string {
    if (showName === undefined) {
      showName = false;
    }
    const response = `#${this.cpfCnpj}` + showName ? ` '${this.nome}'` : '';
    return response;
  }
}
