import { EntityHelper } from 'src/utils/entity-helper';
import { Column, DeepPartial, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('Pagador')
export class Pagador extends EntityHelper {
  constructor(pagador?: Pagador | DeepPartial<Pagador>) {
    super();
    if (pagador !== undefined) {
      Object.assign(this, pagador);
    }
  }

  @PrimaryGeneratedColumn()
  id_pagador: number;

  @Column({ type: String, unique: false, nullable: false, length: 150 })
  nome_empresa: string;

  @Column({ type: String, unique: false, nullable: true, length: 5 })
  agencia: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dv_agencia: string;

  @Column({ type: String, unique: false, nullable: true, length: 12 })
  conta: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  dv_conta: string;

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
  complemento_cep: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  uf: string;

  @Column({ type: String, unique: false, nullable: true, length: 2 })
  cpf_cnpj: string;

  public getLogInfo(): string {
    const response =
      `#${this.id_pagador}` + ` '${this.nome_empresa.substring(0, 15)}...'`;
    return response;
  }
}
