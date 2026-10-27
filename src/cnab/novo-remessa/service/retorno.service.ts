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

    /**
     * Um arquivo de retorno grande leva muitos minutos para ser processado e só sai de /retorno ao final.
     * Sem esta trava, a próxima execução do cron (a cada 30 min) lê o MESMO arquivo e o processa de novo
     * em paralelo, aplicando o segundo retorno em cima do primeiro.
     */
    private emProcessamento = false;

    //LER ARQUIVO TXT CNAB DO SFTP
    public async lerRetornoSftp(folder?: string) {
        if (this.emProcessamento) {
            this.logger.warn('Retorno anterior ainda em processamento; nenhum arquivo será lido agora.');
            return null;
        }
        return await this.sftpService.getFirstRetornoPagamento(folder);
    }

    public async salvarRetorno(cnab: { name: string, content: string }) {
        if (this.emProcessamento) {
            this.logger.warn(`Retorno ${cnab.name} ignorado: outro arquivo está em processamento.`);
            return;
        }
        this.emProcessamento = true;
        try {
            await this.processarRetorno(cnab);
        } finally {
            this.emProcessamento = false;
        }
    }

    private async processarRetorno(cnab: { name: string, content: string }) {
        this.logger.debug(`Iniciada a leitura do arquivo: ${cnab.name} - ${new Date()}`);
        const retorno104 = parseCnab240Pagamento(cnab.content);
        let casados = 0;
        let semCorrespondencia = 0;
        try {
            for (const cnabLote of retorno104.lotes) {
                // Conta do pagador do lote (CB, CETT/gratuidade ou rotativo): separa pagamentos de contas
                // diferentes que tenham o mesmo CPF, valor e data.
                const contaPagador = String(cnabLote.headerLote.numeroConta?.value ?? '').trim();
                for (const registro of cnabLote.registros) {
                    const detalheA = await this.detalheAService.getDetalheARetorno(
                        registro.detalheB.numeroInscricao.convertedValue,
                        registro.detalheA.valorLancamento.convertedValue,
                        registro.detalheA.dataVencimento.convertedValue,
                        contaPagador || undefined,
                    )
                    this.logger.debug(`Banco: ${registro.detalheA.codigoBancoDestino.convertedValue}
                         - agencia: ${registro.detalheA.codigoAgenciaDestino.convertedValue}
                         - conta: ${registro.detalheA.contaCorrenteDestino.convertedValue}`);
                    if (detalheA[0]) {
                        casados++;
                        await this.atualizarStatusRemessaHistorico(cnabLote, registro, detalheA[0]);
                    } else {
                        semCorrespondencia++;
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
            // Um arquivo cujos registros não casaram com nenhum pagamento vai para o backup de sucesso
            // sem baixar nada; o resumo deixa isso visível no log em vez de passar despercebido.
            if (semCorrespondencia > 0) {
                this.logger.error(
                    `Retorno ${cnab.name}: ${semCorrespondencia} registro(s) sem pagamento correspondente` +
                    ` e ${casados} atualizado(s).`,
                    undefined,
                );
            } else {
                this.logger.log(`Retorno ${cnab.name}: ${casados} registro(s) atualizado(s).`);
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

    private ocorrenciaOk(ocorrencia: string) {
        const valor = (ocorrencia ?? '').trim();
        return valor === 'BD' || valor === '00';
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
                if (historico.statusRemessa === StatusRemessaEnum.PreparadoParaEnvio && cnabLote.headerLote.ocorrencias.value.trim() !== historico.motivoStatusRemessa) {
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
                } else if (historico.statusRemessa === StatusRemessaEnum.NaoEfetivado && !historico.motivoStatusRemessa
                    && this.ocorrenciaOk(cnabLote.headerLote.ocorrencias.value)
                    && this.ocorrenciaOk(registro.detalheA.ocorrencias.value)) {
                    // Rejeição do arquivo inteiro (ocorrência do lote em branco) marca tudo como NaoEfetivado SEM motivo. Se o
                    // banco aceitou o reenvio, "BD" volta o pagamento para Aguardando e "00" o efetiva. Com motivo preenchido
                    // (erro real do pagamento) o histórico continua NaoEfetivado.
                    const ocorrenciaDetalhe = registro.detalheA.ocorrencias.value.trim();
                    historico.motivoStatusRemessa = ocorrenciaDetalhe;
                    await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                        historico,
                        ocorrenciaDetalhe === 'BD'
                            ? StatusRemessaEnum.AguardandoPagamento
                            : (historicos.length > 1 ? StatusRemessaEnum.PendenciaPaga : StatusRemessaEnum.Efetivado),
                    );
                } else if (historico.statusRemessa === StatusRemessaEnum.AguardandoPagamento) {
                    historico.motivoStatusRemessa = registro.detalheA.ocorrencias.value.trim();
                    //SE O HEADER LOTE ESTIVER COM ERRO TODOS OS DETALHES FICAM COMO NÃO EFETIVADOS    
                    if (cnabLote.headerLote.ocorrencias.value.trim() !== 'BD' && cnabLote.headerLote.ocorrencias.value.trim() !== '00') {
                        historico.motivoStatusRemessa = cnabLote.headerLote.ocorrencias.value;
                        await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                            historico,
                            StatusRemessaEnum.NaoEfetivado
                        )
                    } else if (registro.detalheA.ocorrencias.value.trim() === 'BD') {
                        // "BD" = inclusão efetuada (confirmação do 1º retorno), não pagamento. Se o mesmo "BD" chegar de novo
                        // (arquivo repetido ou processado em duplicidade), o pagamento continua Aguardando Pagamento:
                        // só a ocorrência "00" (crédito efetivado) do 2º retorno finaliza.
                        this.logger.debug(`historico ${historico.id}: "BD" repetido, segue Aguardando Pagamento`);
                    } else if (registro.detalheA.ocorrencias.value.trim() === '00') {

                        // historicos = a linha desta OPA + qualquer filha dela
                        // ainda em aberto (ver getHistorico). Se existe filha,
                        // esta resolução é de uma pendência - a OPA (pai ou
                        // filha) vira PendenciaPaga, não Efetivado. Só fica
                        // Efetivado quando não há relação pai/filha nenhuma
                        // (pagamento normal, nunca foi pendente).
                        const status = historicos.length > 1 ? StatusRemessaEnum.PendenciaPaga : StatusRemessaEnum.Efetivado;

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

        // Retorno de pendentes: se a ordem pai foi resolvida (paga ou falhou de
        // novo), o resultado cobre as ordens filhas. O relatório lê o histórico
        // das filhas, então propagamos: pai paga -> filhas PendenciaPaga; pai
        // falhou -> filhas NaoEfetivado (mesmo motivo). Não faz nada se a pai
        // ainda não foi resolvida.
        const filhasAtualizadas = await this.ordemPagamentoAgrupadoService.propagarPagamentoPaiParaFilhas(detalheA.id);
        if (filhasAtualizadas > 0) {
            this.logger.debug(
                `Retorno: ordem pai resolvida - propagado status para ${filhasAtualizadas} ` +
                `historico(s) de ordens filhas (detalheA ${detalheA.id})`,
            );
        }
    }
}
