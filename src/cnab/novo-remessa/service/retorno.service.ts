import { Injectable } from "@nestjs/common";
import { DetalheAService } from "src/cnab/service/pagamento/detalhe-a.service";
import { SftpService } from "src/sftp/sftp.service";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamentoAgrupadoService } from "./ordem-pagamento-agrupado.service";
import { parseCnab240Pagamento } from "src/cnab/utils/cnab/cnab-104-utils";
import { StatusRemessaEnum, getStatusRemessaEnumByValue } from "src/cnab/enums/novo-remessa/status-remessa.enum";
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
                        registro.detalheB.numeroInscricao.convertedValue,
                        registro.detalheA.valorLancamento.convertedValue
                    )
                    this.logger.debug(`Banco: ${registro.detalheA.codigoBancoDestino.convertedValue}
                         - agencia: ${registro.detalheA.codigoAgenciaDestino.convertedValue}
                         - conta: ${registro.detalheA.contaCorrenteDestino.convertedValue}`);
                    if (detalheA[0]) {
                        await this.atualizarStatusRemessaHistorico(cnabLote, registro, detalheA[0]);
                    } else {
                        this.logger.warn(
                            `Retorno sem detalheA correspondente - arquivo: ${cnab.name}` +
                            ` - cpfCnpj: ${registro.detalheB.numeroInscricao.convertedValue}` +
                            ` - valorLancamento: ${registro.detalheA.valorLancamento.convertedValue}` +
                            ` - ocorrenciaDetalheA: '${registro.detalheA.ocorrencias.value.trim()}'` +
                            ` - ocorrenciaHeaderLote: '${cnabLote.headerLote.ocorrencias.value.trim()}'`,
                        );
                    }
                }
            }
            await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoSuccess, cnab.content);
        } catch (error) {
            this.logger.error(
                `Erro ao processar retorno - arquivo: ${cnab.name} - ${error?.message}`,
                error?.stack,
            );
            await this.sftpService.moveToBackup(cnab.name, SftpBackupFolder.RetornoFailure, cnab.content);
        }
    }

    private async atualizarStatusRemessaHistorico(
        cnabLote: CnabLote104Pgto, registro: CnabRegistros104Pgto, detalheA: DetalheA) {
        const historicos = await this.ordemPagamentoAgrupadoService.getHistorico(detalheA.id);
        this.logger.debug(
            `atualizarStatusRemessaHistorico - detalheA: ${detalheA.id}` +
            ` - ocorrenciaDetalheA: '${registro.detalheA.ocorrencias.value.trim()}'` +
            ` - ocorrenciaHeaderLote: '${cnabLote.headerLote.ocorrencias.value.trim()}'` +
            ` - historicos: ${historicos.length}`,
        );

        for (let i = 0; i < historicos.length; i++) {
            const historico = historicos[i];
            this.logger.debug(
                `historico id: ${historico.id} - indice: ${i}` +
                ` - statusAtual: ${getStatusRemessaEnumByValue(historico.statusRemessa)}`,
            );
            if (detalheA && historico) {
                if (historico.statusRemessa === StatusRemessaEnum.PreparadoParaEnvio) {
                    //SE O HEADER LOTE ESTIVER COM ERRO TODOS OS DETALHES FICAM COMO NÃO EFETIVADOS
                    if (cnabLote.headerLote.ocorrencias.value.trim() !== 'BD' && cnabLote.headerLote.ocorrencias.value.trim() !== '00') {
                        historico.motivoStatusRemessa = cnabLote.headerLote.ocorrencias.value.trim();
                        await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                            historico,
                            StatusRemessaEnum.NaoEfetivado
                        );
                        this.logger.debug(
                            `historico ${historico.id} -> NaoEfetivado (erro no header lote: ` +
                            `'${cnabLote.headerLote.ocorrencias.value.trim()}')`,
                        );
                        return;
                    }

                    if (registro.detalheA.ocorrencias.value.trim() === '00' || registro.detalheA.ocorrencias.value.trim() == 'BD') {
                        historico.motivoStatusRemessa = registro.detalheA.ocorrencias.value.trim();
                        await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                            historico,
                            StatusRemessaEnum.AguardandoPagamento
                        );
                    } else {
                        historico.motivoStatusRemessa = registro.detalheA.ocorrencias.value.trim();
                        await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                            historico,
                            StatusRemessaEnum.NaoEfetivado,
                        );
                    }                  
                } else if (historico.statusRemessa === StatusRemessaEnum.AguardandoPagamento) {
                    historico.motivoStatusRemessa = registro.detalheA.ocorrencias.value.trim();
                    //SE O HEADER LOTE ESTIVER COM ERRO TODOS OS DETALHES FICAM COMO NÃO EFETIVADOS    
                    if (cnabLote.headerLote.ocorrencias.value.trim() !== 'BD' && cnabLote.headerLote.ocorrencias.value.trim() !== '00') {
                        historico.motivoStatusRemessa = cnabLote.headerLote.ocorrencias.value;
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
                this.logger.debug(
                    `historico ${historico.id} - status final: ${getStatusRemessaEnumByValue(historico.statusRemessa)}`,
                );
            }
        }

        // Retorno de pendentes: se a ordem pai foi paga, o pagamento cobre as
        // ordens filhas. O relatório lê o histórico das filhas, então propagamos
        // PendenciaPaga para todos os históricos delas. Não faz nada se a pai foi
        // rejeitada/estornada ou ainda não foi paga.
        const filhasAtualizadas = await this.ordemPagamentoAgrupadoService.propagarPagamentoPaiParaFilhas(detalheA.id);
        if (filhasAtualizadas > 0) {
            this.logger.debug(
                `Retorno: ordem pai paga - propagado PendenciaPaga para ${filhasAtualizadas} ` +
                `historico(s) de ordens filhas (detalheA ${detalheA.id})`,
            );
        }
    }
}