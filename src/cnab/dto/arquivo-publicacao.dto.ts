export class ArquivoPublicacaoDTO {
    constructor(dto?: ArquivoPublicacaoDTO) {
      if (dto) {
        Object.assign(this, dto);
      }
    }
    id_arquivo_publicacao: number; 
  
    id_header_arquivo: number;    
    id_transacao: number;
    id_header_lote: number;           
    dt_geracao_remessa: Date;
    hr_geracao_remessa: Date;    
    dt_geracao_retorno: Date;
    hr_geracao_retorno: Date;

    lote_servico: string;
    nome_pagador: string;
    agencia_pagador: string;
    dv_agencia_pagador: string;
    conta_pagador: string;
    dv_conta_pagador: string; 
    
    nome_cliente?: string;
    cpf_cnpj_cliente?: string;
    cod_banco_cliente?: string;
    agencia_cliente?: string;
    dv_agencia_cliente?: string;
    conta_corrente_cliente?: string;
    dv_conta_corrente_cliente?: string;

    dt_vencimento?: Date;    
    valor_lancamento?: number; 
    data_efetivacao?: Date; 
    valor_real_efetivado?: number;
    ocorrencias: string; 
  }