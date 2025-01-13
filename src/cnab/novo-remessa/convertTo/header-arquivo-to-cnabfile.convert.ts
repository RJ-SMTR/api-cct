import { Injectable } from "@nestjs/common";
import { ICnabInfo } from "src/cnab/cnab.service";
import { CnabHeaderArquivo104DTO } from "src/cnab/dto/cnab-240/104/cnab-header-arquivo-104.dto";
import { HeaderArquivo } from "src/cnab/entity/pagamento/header-arquivo.entity";
import { Cnab104PgtoTemplates } from "src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const";
import { CustomLogger } from "src/utils/custom-logger";
import { CnabRegistros104Pgto } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface";
import { DetalheBService } from "src/cnab/service/pagamento/detalhe-b.service";
import { DetalhesToCnab } from "./detalhes-to-cnab.convert";
import { CnabFile104PgtoDTO } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface";
import { CnabHeaderLote104PgtoDTO } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface";
import { stringifyCnab104File } from "src/cnab/utils/cnab/cnab-104-utils";


@Injectable()
export class HeaderArquivoToCnabFile {

  static logger = new CustomLogger(HeaderArquivoToCnabFile.name, { timestamp: true });

  private static detalheBService: DetalheBService

  constructor() { }

  static convert(headerArquivo: HeaderArquivo): ICnabInfo[]{

    const listCnab: ICnabInfo[] = [];

    const headerArquivo104 = CnabHeaderArquivo104DTO.fromDTO(headerArquivo);

    const trailerArquivo104 = structuredClone(Cnab104PgtoTemplates.file104.registros.trailerArquivo);

    const registros: CnabRegistros104Pgto[] = [];      
        
    headerArquivo.headersLote.forEach((headerLote) => {
      
      headerLote.detalhesA.forEach(async (detalheA) => {
         
        const detalheB = await this.detalheBService.findOne({detalheA:{id: detalheA.id}});
          if(detalheB) {
            const detalhes = await DetalhesToCnab.convert(detalheA, detalheB);        
            registros.push(detalhes);
          }
        });        

    });     

    const cnab104 = new CnabFile104PgtoDTO({
      headerArquivo: headerArquivo104,
      lotes: headerArquivo.headersLote.map((headerLote) => ({
        headerLote: CnabHeaderLote104PgtoDTO.fromDTO(headerLote),
        registros: registros,
        trailerLote: structuredClone(Cnab104PgtoTemplates.file104.registros.trailerLote),
      })),
      trailerArquivo: trailerArquivo104,
    });

    if (headerArquivo && cnab104) {
      const [cnabStr] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
      if (!cnabStr) {
        this.logger.warn(`Não foi gerado um cnabString - headerArqId: ${headerArquivo.id}`);   
      }
      listCnab.push({ name: '', content: cnabStr, headerArquivo: headerArquivo });
    }
    return listCnab;
  }

}