
export class HeaderArquivoDTO{
    id_header_arquivo:number;
    tipo_arquivo :string;
    cod_banco :string;
    tipo_inscricao:string;
    num_inscricao :string;
    cod_convenio :string;
    param_transmissao :string;    
    agencia :string;
    dv_agencia:string;
    num_conta :string;
    dv_conta:string;
    nome_empresa:string;
    dt_geracao: Date;
    @Column({ arg0: { type: 'timestamp' } })
    hr_geracao: Date;
    id_transacao:number;
}