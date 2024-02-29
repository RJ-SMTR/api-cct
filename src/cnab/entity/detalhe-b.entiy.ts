import { EntityHelper } from "src/utils/entity-helper";
import { Column,  Entity , PrimaryGeneratedColumn} from 'typeorm';

@Entity()
export class DetalheB extends EntityHelper{
    @PrimaryGeneratedColumn()
    id_detalhe_b:number;
    @Column({ type: Number, unique: false, nullable: true })
    id_detalhe_a :number;
    @Column({ type: String, unique: false, nullable: true })
    nsr:string; 
    @Column({ type: Date, unique: false, nullable: true })
    data_vencimento: Date;
}