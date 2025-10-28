import { Injectable } from "@nestjs/common";
import { CustomLogger } from "src/utils/custom-logger";
import { Pagador } from "src/cnab/entity/pagamento/pagador.entity";
import { Cnab104AmbienteCliente } from "src/cnab/enums/104/cnab-104-ambiente-cliente.enum";
import { HeaderArquivoDTO } from "src/cnab/dto/pagamento/header-arquivo.dto";
import { Cnab104PgtoTemplates } from "src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const";
import { HeaderArquivoTipoArquivo } from "src/cnab/enums/pagamento/header-arquivo-tipo-arquivo.enum";
import { HeaderArquivoStatus, HeaderName } from "src/cnab/enums/pagamento/header-arquivo-status.enum";


@Injectable()
export class OrdemPagamentoAgrupadoToHeaderArquivo {
    
    static logger = new CustomLogger(OrdemPagamentoAgrupadoToHeaderArquivo.name, { timestamp: true });   

    constructor() { }

    static convert(pagador: Pagador, nsa: number,headerName: HeaderName) {
        const now = new Date();
            return new HeaderArquivoDTO({
              _isConf: false,
              agencia: pagador.agencia,
              codigoBanco: Cnab104PgtoTemplates.file104.registros.headerArquivo.codigoBanco.value,
              tipoInscricao: Cnab104PgtoTemplates.file104.registros.headerArquivo.tipoInscricao.value,
              numeroInscricao: String(pagador.cpfCnpj),
              codigoConvenio: Cnab104PgtoTemplates.file104.registros.headerArquivo.codigoConvenioBanco.value,
              parametroTransmissao: Cnab104PgtoTemplates.file104.registros.headerArquivo.parametroTransmissao.value,
              dataGeracao: now,
              horaGeracao: now,
              dvAgencia: pagador.dvAgencia,
              dvConta: pagador.dvConta,              
              nomeEmpresa: pagador.nomeEmpresa,
              numeroConta: pagador.conta,
              tipoArquivo: HeaderArquivoTipoArquivo.Remessa,
              nsa:nsa,
              status: HeaderArquivoStatus._2_remessaGerado,
              remessaName: headerName,  
              ambienteCliente: Cnab104AmbienteCliente.Producao,            
            });
    }
}