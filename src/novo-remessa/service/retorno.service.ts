import { Injectable } from "@nestjs/common";
import { DetalheAService } from "src/cnab/service/pagamento/detalhe-a.service";
import { SftpService } from "src/sftp/sftp.service";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamentoAgrupadoService } from "./ordem-pagamento-agrupado.service";
import { parseCnab240Pagamento } from "src/cnab/utils/cnab/cnab-104-utils";
import { StatusRemessaEnum } from "src/cnab/enums/novo-remessa/status-remessa.enum";
import { DetalheA } from "src/cnab/entity/pagamento/detalhe-a.entity";
import { CnabRegistros104Pgto } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface";
import { CnabLote104Pgto } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface";
import { SftpBackupFolder } from "src/sftp/enums/sftp-backup-folder.enum";

@Injectable()
export class RetornoService {
    private logger = new CustomLogger(RetornoService.name, { timestamp: true });

    constructor(
        private ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService,
        private detalheAService: DetalheAService,
        private sftpService: SftpService,
    ) { }

    //LER ARQUIVO TXT CNAB DO SFTP 
    public async lerRetornoSftp(folder?: string) {
        return await this.sftpService.getFirstRetornoPagamento(folder);
    }

    public async salvarRetorno(cnab: { name: string, content: string }) {
        this.logger.debug(`Iniciada a leitura do arquivo: ${cnab.name} - ${new Date()}`);
        const retorno104 = parseCnab240Pagamento(cnab.content);
        try {
            for (const cnabLote of retorno104.lotes) {
                for (const registro of cnabLote.registros) {
                    const detalheA = await this.detalheAService.getDetalheARetorno(
                        registro.detalheA.dataVencimento.convertedValue,
                        registro.detalheA.valorLancamento.convertedValue,
                        registro.detalheA.codigoBancoDestino.convertedValue,
                        registro.detalheA.contaCorrenteDestino.convertedValue
                    )
                    this.logger.debug(`Banco: ${registro.detalheA.codigoBancoDestino.convertedValue} 
                         - agencia: ${registro.detalheA.codigoAgenciaDestino.convertedValue}
                         - conta: ${registro.detalheA.contaCorrenteDestino.convertedValue}`);
                    if(detalheA[0])
                        await this.atualizarStatusRemessaHistorico(cnabLote, registro, detalheA[0]);
                }
            }
            await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoSuccess, cnab.content);
        } catch (error) {
            await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoFailure, cnab.content);
        }
    }

    private async atualizarStatusRemessaHistorico(
        cnabLote: CnabLote104Pgto, registro: CnabRegistros104Pgto, detalheA: DetalheA){
        const historicos = await this.ordemPagamentoAgrupadoService.getHistorico(detalheA.id);
        for (let i = 0; i < historicos.length; i++) {
            const historico = historicos[i];
        if (detalheA && historico) {
            if (historico.statusRemessa === StatusRemessaEnum.PreparadoParaEnvio) {
                historico.dataReferencia = detalheA.dataVencimento;
                //SE O HEADER LOTE ESTIVER COM ERRO TODOS OS DETALHES FICAM COMO NÃO EFETIVADOS    
               if (cnabLote.headerLote.ocorrencias.value.trim() === 'BD' || cnabLote.headerLote.ocorrencias.value.trim() === '00'){                   
                    historico.motivoStatusRemessa = registro.detalheA.ocorrencias.value.trim();
                
                    if(registro.detalheA.ocorrencias.value.trim() === '00' || registro.detalheA.ocorrencias.value.trim()=='BD'){ 
                       await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                           historico,
                           StatusRemessaEnum.AguardandoPagamento  
                       );
                   }else{
                       await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                           historico,
                           StatusRemessaEnum.NaoEfetivado,
                       );
                   }
               }else{
                   historico.motivoStatusRemessa = cnabLote.headerLote.ocorrencias.value.trim();
                   await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                       historico,
                       StatusRemessaEnum.NaoEfetivado
                   );
               }
           } else if (historico.statusRemessa === StatusRemessaEnum.AguardandoPagamento) {
               historico.dataReferencia = detalheA.dataVencimento;
               historico.motivoStatusRemessa = registro.detalheA.ocorrencias.value.trim();
               //SE O HEADER LOTE ESTIVER COM ERRO TODOS OS DETALHES FICAM COMO NÃO EFETIVADOS    
               if (cnabLote.headerLote.ocorrencias.value.trim() !== 'BD' && cnabLote.headerLote.ocorrencias.value.trim() !== '00') {
                   historico.motivoStatusRemessa =  cnabLote.headerLote.ocorrencias.value;
                   await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                       historico,
                       StatusRemessaEnum.NaoEfetivado
                   )
               } else if (registro.detalheA.ocorrencias.value.trim() === 'BD' || registro.detalheA.ocorrencias.value.trim() === '00') {
                
                   const status = i === 0 ? StatusRemessaEnum.Efetivado : StatusRemessaEnum.PendenciaPaga;

                   await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                       historico,
                       status
                   );
               } else {
                   await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                       historico, StatusRemessaEnum.NaoEfetivado);
               }
           }
        }
    }
    }

}  