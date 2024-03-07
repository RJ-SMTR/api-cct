import { EntityHelper } from "src/utils/entity-helper";
import { Column, DeepPartial, PrimaryGeneratedColumn } from "typeorm";

export class ArquivoPublicacao extends EntityHelper {
  constructor(
    arquivoPublicacao?: ArquivoPublicacao | DeepPartial<ArquivoPublicacao>,
    ) {
      super();
      if (arquivoPublicacao !== undefined) {
        Object.assign(this, arquivoPublicacao);
      }
    }
    @PrimaryGeneratedColumn()
    id_publicacao:number;
    
    @Column({ type: String, unique: false, nullable: false})
    id_header_arquivo: number;

    @Column({ type: String, unique: false, nullable: false})
    id_transacao: number;

    @Column({ type: String, unique: false, nullable: false})
    id_header_lote: number;

    @Column({ type: Date, unique: false, nullable: false})
    dt_geracao_remessa: Date;

    @Column({ type: Date, unique: false, nullable: false})
    hr_geracao_remessa: Date; 

    @Column({ type: Date, unique: false, nullable: false})
    dt_geracao_retorno: Date;

    @Column({ type: Date, unique: false, nullable: false})
    hr_geracao_retorno: Date;

    @Column({ type: String, unique: false, nullable: false})
    lote_servico: string;

    @Column({ type: String, unique: false, nullable: false})
    nome_pagador: string;

    @Column({ type: String, unique: false, nullable: false})
    agencia_pagador: string;

    @Column({ type: String, unique: false, nullable: false})
    dv_agencia_pagador: string;

    @Column({ type: String, unique: false, nullable: false})
    conta_pagador: string;

    @Column({ type: String, unique: false, nullable: false})
    dv_conta_pagador: string; 
    
    @Column({ type: String, unique: false, nullable: false})
    nome_cliente?: string;

    @Column({ type: String, unique: false, nullable: false})
    cpf_cnpj_cliente?: string;

    @Column({ type: String, unique: false, nullable: false})
    cod_banco_cliente?: string;

    @Column({ type: String, unique: false, nullable: false})
    agencia_cliente?: string;

    @Column({ type: String, unique: false, nullable: false})
    dv_agencia_cliente?: string;

    @Column({ type: String, unique: false, nullable: false})
    conta_corrente_cliente?: string;

    @Column({ type: String, unique: false, nullable: false})
    dv_conta_corrente_cliente?: string;

    @Column({ type: String, unique: false, nullable: false})
    dt_vencimento?: Date;  

    @Column({ type: String, unique: false, nullable: false})
    valor_lancamento?: number;

    @Column({ type: String, unique: false, nullable: false})
    data_efetivacao?: Date;

    @Column({ type: String, unique: false, nullable: false})
    valor_real_efetivado?: number;

    @Column({ type: String, unique: false, nullable: false})
    ocorrencias: string;
  }