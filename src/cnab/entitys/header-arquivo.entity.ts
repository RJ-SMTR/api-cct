import { EntityHelper } from "src/utils/entity-helper";

@Entity()
class HeaderArquivo extends EntityHelper{
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
    @Column({ type: 'timestamp' })
    hr_geracao: Date;
    id_transacao:number;
}

function Column(arg0: { type: string; }): (target: HeaderArquivo, propertyKey: "hr_geracao") => void {
    throw new Error("Function not implemented.");
}
function Entity(): (target: typeof HeaderArquivo) => void | typeof HeaderArquivo {
    throw new Error("Function not implemented.");
}

