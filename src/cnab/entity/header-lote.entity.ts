import { EntityHelper } from "src/utils/entity-helper";
import { Column,  Entity , PrimaryGeneratedColumn} from 'typeorm';

@Entity()
export class HeaderLote extends EntityHelper{
    @PrimaryGeneratedColumn()
    id_header_lote:number;
    @Column({ type: Number, unique: false, nullable: true })
    id_header_arquivo:number;
    @Column({ type: String, unique: false, nullable: true })
    lote_servico:string;
    @Column({ type: String, unique: false, nullable: true })
    tipo_inscricao:string;
    @Column({ type: String, unique: false, nullable: true })
    num_inscricao:string;
    @Column({ type: String, unique: false, nullable: true })
    cod_convenio_banco:string;
    @Column({ type: String, unique: false, nullable: true })
    tipo_compromisso:string;    
    @Column({ type: String, unique: false, nullable: true })
    param_transmissao:string;
    @Column({ type: Number, unique: false, nullable: true })
    id_pagadora:number;
}