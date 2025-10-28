import { Injectable } from "@nestjs/common";
import { CnabHeaderArquivo104 } from "src/cnab/dto/cnab-240/104/cnab-header-arquivo-104.dto";
import { HeaderArquivo } from "src/cnab/entity/pagamento/header-arquivo.entity";
import { Cnab104AmbienteCliente } from "src/cnab/enums/104/cnab-104-ambiente-cliente.enum";
import { Cnab104PgtoTemplates } from "src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const";
import { CustomLogger } from "src/utils/custom-logger";


@Injectable()
export class HeaderArquivoToCnabFile {

  static logger = new CustomLogger(HeaderArquivoToCnabFile.name, { timestamp: true });

  constructor() { }

  static convert(headerArquivo: HeaderArquivo):CnabHeaderArquivo104{  
    const headerArquivo104: CnabHeaderArquivo104 = structuredClone(Cnab104PgtoTemplates.file104.registros.headerArquivo);
      headerArquivo104.codigoBanco.value = headerArquivo.codigoBanco;
      headerArquivo104.numeroInscricao.value = headerArquivo.numeroInscricao;
      headerArquivo104.codigoConvenioBanco.value = headerArquivo.codigoConvenio;
      headerArquivo104.parametroTransmissao.value = headerArquivo.parametroTransmissao;
      headerArquivo104.agenciaContaCorrente.value = headerArquivo.agencia;
      headerArquivo104.numeroConta.value = headerArquivo.numeroConta;
      headerArquivo104.dvAgencia.value = headerArquivo.dvAgencia;
      headerArquivo104.dvConta.value = headerArquivo.dvConta;
      headerArquivo104.nomeEmpresa.value = headerArquivo.nomeEmpresa;
      headerArquivo104.tipoArquivo.value = headerArquivo.tipoArquivo;
      headerArquivo104.dataGeracaoArquivo.value =  headerArquivo.dataGeracao;
      headerArquivo104.horaGeracaoArquivo.value = headerArquivo.horaGeracao;
      headerArquivo104.nsa.value = headerArquivo.nsa;
      headerArquivo104.ambienteCliente.value = Cnab104AmbienteCliente.Producao;
    return headerArquivo104;   
  }    
}