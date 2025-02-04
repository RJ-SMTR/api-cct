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

        for (const cnabLote of retorno104.lotes) {
            for (const registro of cnabLote.registros) {
                const detalheA = await this.detalheAService.getOne({
                    dataVencimento: registro.detalheA.dataVencimento.value,
                    valorLancamento: registro.detalheA.valorLancamento.value,
                    ordemPagamentoAgrupadoHistorico: {
                        userBankCode: registro.detalheA.codigoBancoDestino.value,
                        userBankAgency: registro.detalheA.codigoAgenciaDestino.value,
                        userBankAccount: registro.detalheA.contaCorrenteDestino.value,
                        statusRemessa: StatusRemessaEnum.PreparadoParaEnvio | StatusRemessaEnum.AguardandoPagamento
                    }
                })
                this.atualizarStatusRemessaHistorico(cnabLote, registro, detalheA);
            }
        }
    }

    private async atualizarStatusRemessaHistorico(
        cnabLote: CnabLote104Pgto, registro: CnabRegistros104Pgto, detalheA: DetalheA
    ) {
        if (detalheA && detalheA.ordemPagamentoAgrupadoHistorico) {
            if (detalheA.ordemPagamentoAgrupadoHistorico.statusRemessa === StatusRemessaEnum.PreparadoParaEnvio) {
                await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                    detalheA.ordemPagamentoAgrupadoHistorico,
                    StatusRemessaEnum.AguardandoPagamento
                );
            } else if (detalheA.ordemPagamentoAgrupadoHistorico.statusRemessa === StatusRemessaEnum.AguardandoPagamento) {
                detalheA.ordemPagamentoAgrupadoHistorico.dataReferencia = new Date();
                detalheA.ordemPagamentoAgrupadoHistorico.motivoStatusRemessa =
                    registro.detalheA.ocorrencias.value;
                //SE O HEADER LOTE ESTIVER COM ERRO TODOS OS DETALHES FICAM COMO NÃO EFETIVADOS    
                if (!cnabLote.headerLote.ocorrencias.value.in('BD', '00')) {
                    detalheA.ordemPagamentoAgrupadoHistorico.motivoStatusRemessa =
                        cnabLote.headerLote.ocorrencias.value;
                    await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                        detalheA.ordemPagamentoAgrupadoHistorico,
                        StatusRemessaEnum.NaoEfetivado
                    )
                } else if (registro.detalheA.ocorrencias.value.in('BD', '00')) {
                    await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                        detalheA.ordemPagamentoAgrupadoHistorico,
                        StatusRemessaEnum.Efetivado
                    )
                } else {
                    await this.ordemPagamentoAgrupadoService.saveStatusHistorico(
                        detalheA.ordemPagamentoAgrupadoHistorico,
                        StatusRemessaEnum.NaoEfetivado
                    );
                }
            }
        }
    }
}  