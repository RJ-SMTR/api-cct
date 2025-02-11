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
                    this.logger.debug(`Banco: ${registro.detalheA.codigoBancoDestino.convertedValue} - agencia: ${registro.detalheA.codigoAgenciaDestino.convertedValue}
                         - conta: ${registro.detalheA.contaCorrenteDestino.convertedValue}`);
                    await this.atualizarStatusRemessaHistorico(cnabLote, registro, detalheA[0]);
                }
            }
            await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoSuccess, cnab.content);
        } catch (error) {
            await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoFailure, cnab.content);
        }
    }

    private async atualizarStatusRemessaHistorico(
        cnabLote: CnabLote104Pgto, registro: CnabRegistros104Pgto, detalheA: DetalheA
    ) {
        const historico = await this.ordemPagamentoAgrupadoService.getHistorico(detalheA.id);

        if (detalheA && historico) {
            const ocorrenciaHeaderLote = cnabLote.headerLote.ocorrencias.value.trim();
            const ocorrenciaDetalheA = registro.detalheA.ocorrencias.value.trim();
        
            const saveStatus = async (status) => {
                await this.ordemPagamentoAgrupadoService.saveStatusHistorico(historico, status);
            };

            if (historico.statusRemessa === StatusRemessaEnum.PreparadoParaEnvio) {
                if (ocorrenciaHeaderLote !== 'BD' && ocorrenciaHeaderLote !== '00') {
                    const status = (ocorrenciaDetalheA === '00' || ocorrenciaDetalheA === 'BD')
                        ? StatusRemessaEnum.AguardandoPagamento
                        : StatusRemessaEnum.NaoEfetivado;
                    await saveStatus(status);
                } else {
                    await saveStatus(StatusRemessaEnum.NaoEfetivado);
                }
            } else if (historico.statusRemessa === StatusRemessaEnum.AguardandoPagamento) {
                historico.dataReferencia = new Date();
                historico.motivoStatusRemessa = ocorrenciaDetalheA;
        
                if (ocorrenciaHeaderLote !== 'BD' && ocorrenciaHeaderLote !== '00') {
                    historico.motivoStatusRemessa = ocorrenciaHeaderLote;
                    await saveStatus(StatusRemessaEnum.NaoEfetivado);
                } else {
                    const status = (ocorrenciaDetalheA === 'BD' || ocorrenciaDetalheA === '00')
                        ? StatusRemessaEnum.Efetivado
                        : StatusRemessaEnum.NaoEfetivado;
                    await saveStatus(status);
                }
            }
        }
    }
}  