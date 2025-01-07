import { Injectable } from "@nestjs/common";
import { DetalheA } from "src/cnab/entity/pagamento/detalhe-a.entity";
import { DetalheB } from "src/cnab/entity/pagamento/detalhe-b.entity";
import { CnabDetalheA_104 } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface";
import { CnabDetalheB_104 } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface";
import { Cnab104PgtoTemplates } from "src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const";
import { UsersService } from "src/users/users.service";
import { isCpfOrCnpj } from "src/utils/cpf-cnpj";
import { CustomLogger } from "src/utils/custom-logger";

const sc = structuredClone;
const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class DetalhesToCnab {
   
    static logger = new CustomLogger(DetalhesToCnab.name, { timestamp: true });   

    static userService: UsersService;

    constructor() { }    

    static async convert(detalheA: DetalheA, detalheB: DetalheB) {
        const detalheACnab: CnabDetalheA_104 = sc(PgtoRegistros.detalheA);
        const historico = detalheA.ordemPagamentoAgrupadoHistorico;
        const user = await this.userService.findOne({ id: historico?.ordemPagamentoAgrupado.ordensPagamento[0].userId });

        detalheACnab.codigoBancoDestino.value = historico?.userBankCode;
        detalheACnab.codigoAgenciaDestino.value = historico?.userBankAgency.substring(0, historico.userBankAgency.length - 1);   ;
        detalheACnab.dvAgenciaDestino.value = historico?.userBankAgency.substring(historico.userBankAgency.length - 1); 
        detalheACnab.contaCorrenteDestino.value = historico?.userBankAccount;
        detalheACnab.dvContaDestino.value = historico?.userBankAccountDigit;
        detalheACnab.nomeTerceiro.value = user?.fullName;
        detalheACnab.numeroDocumentoEmpresa.value = detalheA.numeroDocumentoEmpresa;
        detalheACnab.dataVencimento.value = detalheA.dataVencimento;
        detalheACnab.valorLancamento.value = detalheA.valorLancamento;
        detalheACnab.valorRealEfetivado.value = detalheA.valorRealEfetivado;        
        detalheACnab.nsr.value = detalheA.nsr;

        // DetalheB
        const detalheBCnab: CnabDetalheB_104 = sc(PgtoRegistros.detalheB);
        detalheBCnab.tipoInscricao.value = isCpfOrCnpj(user?.cpfCnpj);          
        detalheBCnab.numeroInscricao.value = user?.cpfCnpj;
        detalheBCnab.dataVencimento.value = detalheA.dataVencimento;    
        detalheBCnab.nsr.value = detalheB.nsr;

        return {
            detalheA: detalheACnab,
            detalheB: detalheBCnab,
        };
    }
}