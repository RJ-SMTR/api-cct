import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('transacao_bigquery') 
export class BigqueryTransacaoDiario {
    @PrimaryColumn({ type: 'varchar', length: 100 })
    id_transacao: string;

    @Column({ type: 'date', nullable: true })
    data?: Date;

    @Column({ type: 'timestamp', nullable: true })
    datetime_transacao?: Date;

    @Column({ type: 'varchar',  nullable: true })
    consorcio?: string;

    @Column({
        type: 'decimal',
        unique: false,
        nullable: false,
        precision: 13,
        scale: 5,
})
    valor_pagamento?: number;

    @Column({ type: 'varchar',  nullable: true })
    id_ordem_pagamento?: string;

    @Column({ type: 'varchar',  nullable: true })
    id_ordem_pagamento_consorcio_operador_dia?: string;

    @Column({ type: 'varchar',  nullable: true })
    tipo_transacao?: string;

    @Column({ type: 'timestamp', nullable: true })
    datetime_ultima_atualizacao?: Date;
}
