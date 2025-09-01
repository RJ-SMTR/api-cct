import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('aux_user_desativado')
export class AuxUserDesativado {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    fullName: string;

    @Column({ type: 'varchar', length: 20, unique: true })
    cpfCnpj: string;

    @Column({ type: 'varchar', length: 50, nullable: true })
    permitCode: string;
    @Column({ type: 'int' })    
    idUser: number;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;
}
