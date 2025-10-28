import { Injectable } from "@nestjs/common";
import { DetalheA } from "src/cnab/entity/pagamento/detalhe-a.entity";
import { DetalheB } from "src/cnab/entity/pagamento/detalhe-b.entity";
import { CnabDetalheA_104 } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface";
import { CnabDetalheB_104 } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface";
import { Cnab104PgtoTemplates } from "src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const";
import { UsersService } from "src/users/users.service";
import { isCpfOrCnpj } from "src/utils/cpf-cnpj";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamentoAgrupadoHistorico } from "../entity/ordem-pagamento-agrupado-historico.entity";
import { OrdemPagamentoAgrupadoHistoricoDTO } from "../dto/ordem-pagamento-agrupado-historico.dto";
import { CnabTipoInscricao } from "src/cnab/enums/all/cnab-tipo-inscricao.enum";

const sc = structuredClone;
const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class DetalhesToCnab {
   
    static logger = new CustomLogger(DetalhesToCnab.name, { timestamp: true });   

    static userService: UsersService;

    constructor() { }    

    static async convert(detalheA: DetalheA, detalheB: DetalheB,
        historico: OrdemPagamentoAgrupadoHistoricoDTO) {
        const detalheACnab: CnabDetalheA_104 = sc(PgtoRegistros.detalheA);
        detalheACnab.codigoBancoDestino.value = historico?.userBankCode;
        detalheACnab.codigoAgenciaDestino.value = historico?.userBankAgency;        
        detalheACnab.contaCorrenteDestino.value = historico?.userBankAccount;
        detalheACnab.dvContaDestino.value = historico?.userBankAccountDigit;
        detalheACnab.nomeTerceiro.value = historico.username;
        detalheACnab.numeroDocumentoEmpresa.value = detalheA.numeroDocumentoEmpresa;
        detalheACnab.dataVencimento.value = detalheA.dataVencimento;
        detalheACnab.valorLancamento.value = Number(detalheA.valorLancamento);
        detalheACnab.valorRealEfetivado.value = detalheA.valorRealEfetivado;        
        detalheACnab.nsr.value = detalheA.nsr;        

        // DetalheB
        const detalheBCnab: CnabDetalheB_104 = sc(PgtoRegistros.detalheB);
        detalheBCnab.tipoInscricao.value = isCpfOrCnpj(historico?.usercpfcnpj) ==='cpf'?CnabTipoInscricao.CPF:CnabTipoInscricao.CNPJ;          
        detalheBCnab.numeroInscricao.value = historico?.usercpfcnpj;
        detalheBCnab.dataVencimento.value = detalheA.dataVencimento;    
        detalheBCnab.nsr.value = detalheB.nsr;

        return {
            detalheA: detalheACnab,
            detalheB: detalheBCnab,
        };
    }
}