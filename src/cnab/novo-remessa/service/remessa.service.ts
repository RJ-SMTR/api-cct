import { Injectable } from "@nestjs/common";
import { CustomLogger } from "src/utils/custom-logger";
import { OrdemPagamentoAgrupadoService } from "./ordem-pagamento-agrupado.service";
import { HeaderArquivoService } from "src/cnab/service/pagamento/header-arquivo.service";
import { HeaderLoteService } from "src/cnab/service/pagamento/header-lote.service";
import { DetalheAService } from "src/cnab/service/pagamento/detalhe-a.service";
import { DetalheBService } from "src/cnab/service/pagamento/detalhe-b.service";
import { OrdemPagamentoAgrupadoToHeaderArquivo } from "../convertTo/ordem-pagamento-agrupado-to-header-arquivo.convert";
import { Pagador } from "src/cnab/entity/pagamento/pagador.entity";
import { HeaderArquivo } from "src/cnab/entity/pagamento/header-arquivo.entity";
import { OrdemPagamentoAgrupado } from "../entity/ordem-pagamento-agrupado.entity";
import { SettingsService } from "src/settings/settings.service";
import { UsersService } from "src/users/users.service";
import { HeaderLote } from "src/cnab/entity/pagamento/header-lote.entity";
import { HeaderLoteDTO } from "src/cnab/dto/pagamento/header-lote.dto";
import { Cnab104FormaLancamento } from "src/cnab/enums/104/cnab-104-forma-lancamento.enum";
import { HeaderLoteToDetalheA } from "../convertTo/header-lote-to-detalhe-a.convert";
import { DetalheAToDetalheB } from "../convertTo/detalhe-a-to-detalhe-b.convert";
import { ICnabInfo } from "src/cnab/cnab.service";
import { SftpService } from "src/sftp/sftp.service";
import { HeaderArquivoStatus, HeaderName } from "src/cnab/enums/pagamento/header-arquivo-status.enum";
import { StatusRemessaEnum } from "src/cnab/enums/novo-remessa/status-remessa.enum";
import { isEmpty } from "class-validator";
import { PagadorService } from "src/cnab/service/pagamento/pagador.service";
import { OrdemPagamentoAgrupadoHistorico } from "../entity/ordem-pagamento-agrupado-historico.entity";
import { DetalhesToCnab } from "../convertTo/detalhes-to-cnab.convert";
import { CnabRegistros104Pgto } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface";
import { Cnab104PgtoTemplates } from "src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const";
import { CnabFile104PgtoDTO } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface";
import { CnabHeaderLote104PgtoDTO } from "src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface";
import { stringifyCnab104File } from "src/cnab/utils/cnab/cnab-104-utils";
import { CnabHeaderArquivo104DTO } from "src/cnab/dto/cnab-240/104/cnab-header-arquivo-104.dto";
import { PagamentoIndevidoService } from "src/pagamento_indevido/service/pgamento-indevido-service";
import { PagamentoIndevidoDTO } from "src/pagamento_indevido/dto/pagamento-indevido.dto";

@Injectable()
export class RemessaService {
  private logger = new CustomLogger(RemessaService.name, { timestamp: true });

  constructor(
    private ordemPagamentoAgrupadoService: OrdemPagamentoAgrupadoService,
    private headerArquivoService: HeaderArquivoService,
    private headerLoteService: HeaderLoteService,
    private detalheAService: DetalheAService,
    private detalheBService: DetalheBService,
    private settingsService: SettingsService,
    private userService: UsersService,
    private sftpService: SftpService,
    private pagadorService: PagadorService,
    private pagamentoIndevidoService: PagamentoIndevidoService
  ) { }

  //PREPARA DADOS AGRUPADOS SALVANDO NAS TABELAS CNAB
  public async prepararRemessa(dataInicio: Date, dataFim: Date, dataPgto?: Date, consorcio?: string[], pagamentoUnico?: boolean) {
    const ordens = pagamentoUnico
      ? await this.ordemPagamentoAgrupadoService.getOrdensUnicas(
        dataInicio,
        dataFim,
        dataPgto ?? new Date()
      )
      : await this.ordemPagamentoAgrupadoService.getOrdens(dataInicio, dataFim, consorcio);


    if (!isEmpty(ordens)) {
      const pagador = await this.pagadorService.getOneByIdPagador(ordens[0].pagadorId);
      const headerArquivo = await this.gerarHeaderArquivo(pagador, this.getHeaderName(consorcio));

      let nsrTed = 1;
      let nsrCC = 1;

      const getUser = async (op: any) => pagamentoUnico
        ? await this.userService.getOne({ permitCode: op.idOperadora })
        : await this.userService.getOne({ id: op.userId });

      const getOrdem = async (ordem: any) => pagamentoUnico
        ? await this.ordemPagamentoAgrupadoService.getOrdemPagamentoUnico(ordem.id)
        : await this.ordemPagamentoAgrupadoService.getOrdemPagamento(ordem.id);

      const getOpa = async (op: any) => pagamentoUnico
        ? await this.ordemPagamentoAgrupadoService.getOrdemPagamentoAgrupado(Number(op.idOrdemPagamento))
        : op.ordemPagamentoAgrupado;

      for (const ordem of ordens) {
        const op = await getOrdem(ordem);
        if (!op) continue;

        const user = await getUser(op);
        if (!user.bankCode) continue;

        const indevido = await this.pagamentoIndevidoService.findByNome(user.fullName);
        const headerLote = await this.gerarHeaderLote(headerArquivo, pagador, user.bankCode);
        if (!headerLote) continue;

        const opa = await getOpa(op);

        const nsr = headerLote.formaLancamento === '41' ? nsrTed : nsrCC;
        const detalhe = await this.gerarDetalheAB(headerLote, opa, nsr, indevido?.[0] ?? indevido, pagamentoUnico);

        if (detalhe) {
          this.atualizaStatusRemessa(ordem, StatusRemessaEnum.PreparadoParaEnvio);
          this.logger.debug(`Remessa preparado para: ${user.fullName} - ${headerLote.formaLancamento === '41' ? 'TED' : 'CC'}`);
          if (headerLote.formaLancamento === '41') {
            nsrTed = detalhe.nsr + 1;
          } else {
            nsrCC = detalhe.nsr + 1;
          }
        }
      }
    }

  }

  //PEGA INFORMAÇÕS DAS TABELAS CNAB E GERA O TXT PARA ENVIAR PARA O BANCO
  public async gerarCnabText(headerName: HeaderName, pagamentoUnico?: boolean): Promise<ICnabInfo[]> {
    const headerArquivo = await this.headerArquivoService.getExists(HeaderArquivoStatus._2_remessaGerado, headerName);
    if (headerArquivo[0] !== null && headerArquivo[0] !== undefined) {
      const headerArquivoCnab = CnabHeaderArquivo104DTO.fromDTO(headerArquivo[0]);
      return await this.gerarListaCnab(headerArquivoCnab, headerArquivo[0], pagamentoUnico)
    }
    return [];
  }

  private async gerarListaCnab(
    headerArquivoCnab: any,
    headerArquivo: HeaderArquivo,
    pagamentoUnico?: boolean
  ): Promise<ICnabInfo[]> {
    const listCnab: ICnabInfo[] = [];
    const trailerArquivo104 = structuredClone(Cnab104PgtoTemplates.file104.registros.trailerArquivo);

    const headersLote = await this.headerLoteService.findAll(headerArquivo.id);

    // Função auxiliar para processar cada headerLote
    const processarHeaderLote = async (headerLote: HeaderLote) => {
      const detalhesA = await this.detalheAService.getDetalheAHeaderLote(headerLote.id);

      const registros: CnabRegistros104Pgto[] = await Promise.all(
        detalhesA.map(async (detalhe) => {
          this.logger.debug(`NSR: ${detalhe.nsr}`);

          const historico = await this.ordemPagamentoAgrupadoService.getHistoricosOrdemDetalheA(detalhe.id, pagamentoUnico);
          this.logger.debug(`BANK: ${historico.userBankCode} - ${historico.username}`);

          const detalheB = await this.detalheBService.findDetalheBDetalheAId(detalhe.id);
          this.logger.debug(`DETALHE B: ${detalheB.nsr}`)
          return DetalhesToCnab.convert(detalhe, detalheB, historico);
        })
      );

      // Filtrar registros de acordo com a forma de lançamento
      const registrosFiltrados = headerLote.formaLancamento === '41'
        ? registros.filter(r => r.detalheA.codigoBancoDestino.value !== '104') // Diferente de Caixa
        : registros.filter(r => r.detalheA.codigoBancoDestino.value === '104');

      return {
        headerLote: CnabHeaderLote104PgtoDTO.convert(headerLote, headerArquivo),
        registros: registrosFiltrados,
        trailerLote: structuredClone(Cnab104PgtoTemplates.file104.registros.trailerLote),
      };
    };

    const lotes = await Promise.all(headersLote.map(processarHeaderLote));

    const cnab104 = new CnabFile104PgtoDTO({
      headerArquivo: headerArquivoCnab,
      lotes,
      trailerArquivo: trailerArquivo104,
    });

    if (cnab104) {
      const [cnabStr] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
      if (!cnabStr) {
        this.logger.warn(`Não foi gerado um cnabString - headerArqId: ${headerArquivo.id}`);
      }
      listCnab.push({ name: '', content: cnabStr, headerArquivo });
    }

    return listCnab;
  }

  //PEGA O ARQUIVO TXT GERADO E ENVIA PARA O SFTP
  public async enviarRemessa(listCnab: ICnabInfo[], headerName?: string) {
    for (const cnab of listCnab) {
      cnab.name = await this.sftpService.submitCnabRemessa(cnab.content, headerName);
      if (cnab.name !== '') {
        const remessaName = ((l = cnab.name.split('/')) => l.slice(l.length - 1)[0])();
        await this.headerArquivoService.save({
          id: cnab.headerArquivo.id, remessaName,
          status: HeaderArquivoStatus._3_remessaEnviado
        });
      } else {
        this.logger.debug("Arquivo não enviado por problemas de conexão com o SFTP");
      }
    }
  }

  private async gerarHeaderArquivo(pagador: Pagador, remessaName: HeaderName) {
    let headerArquivoExists =
      await this.headerArquivoService.getExists(HeaderArquivoStatus._2_remessaGerado, remessaName)
    if (isEmpty(headerArquivoExists) || headerArquivoExists[0] === undefined) {
      const nsa = await this.settingsService.getNextNSA(false);
      const convertToHeader = OrdemPagamentoAgrupadoToHeaderArquivo.convert(pagador, nsa, remessaName);
      return await this.headerArquivoService.save(convertToHeader);
    }
    return headerArquivoExists[0];
  }

  private async gerarHeaderLote(headerArquivo: HeaderArquivo, pagador: Pagador, bankCode: number) {
    //verifica se existe header lote para o convenio para esse header arquivo  
    const formaLancamento = (bankCode === 104) ? Cnab104FormaLancamento.CreditoContaCorrente :
      Cnab104FormaLancamento.TED;

    const headersLote = await this.headerLoteService.findByFormaLancamento(headerArquivo.id, formaLancamento);

    if (!isEmpty(headersLote) && headersLote.length > 0) {
      var headerLote = headersLote.filter((h: { formaLancamento: Cnab104FormaLancamento; }) =>
        h.formaLancamento === formaLancamento);

      if (headerLote) {
        return headerLote[0];
      } else {
        return await this.criarHeaderLote(headerArquivo, pagador, formaLancamento)
      }
    } else {
      return await this.criarHeaderLote(headerArquivo, pagador, formaLancamento)
    }
  }

  private async gerarDetalheAB(
    headerLote: HeaderLote,
    ordem: OrdemPagamentoAgrupado,
    nsr: number,
    indevido: PagamentoIndevidoDTO,
    pagamentoUnico?: boolean
  ) {
    // Obtém o histórico relevante
    const ultimoHistorico = pagamentoUnico
      ? await this.ordemPagamentoAgrupadoService.getHistoricoUnico(ordem.id)
      : ordem.ordensPagamentoAgrupadoHistorico.at(-1);

    if (!ultimoHistorico) {
      throw new Error('Não há histórico de pagamento para gerar Detalhe A');
    }
    // Verifica se já existe um Detalhe A
    const detalheAExistente = await this.existsDetalheA(ultimoHistorico);

    // Gera número de documento e DTO
    const numeroDocumento = await this.detalheAService.getNextNumeroDocumento(new Date());
    const detalheADTO = await HeaderLoteToDetalheA.convert(
      headerLote,
      ordem,
      nsr,
      ultimoHistorico,
      numeroDocumento
    );

    // Se já existe Detalhe A, ajusta id e valor
    if (detalheAExistente.length > 0) {
      detalheADTO.id = detalheAExistente[0].id;
      detalheADTO.valorRealEfetivado = detalheAExistente[0].valorLancamento;
    }

    // Ajusta valores para pagamento indevido, se houver
    if (indevido.saldoDevedor > 0) {
      const valor = await this.debitarPagamentoIndevido(indevido, detalheADTO.valorLancamento);
      detalheADTO.valorLancamento = valor;
      detalheADTO.valorRealEfetivado = valor;
    }

    // Salva Detalhe A e converte para Detalhe B
    const detalheASalvo = await this.detalheAService.save(detalheADTO);
    if (!detalheASalvo) return null;

    const detalheB = DetalheAToDetalheB.convert(detalheASalvo, ordem);
    return await this.detalheBService.save(detalheB);
  }


  private async atualizaStatusRemessa(opa: OrdemPagamentoAgrupado, statusRemessa: StatusRemessaEnum) {
    const historico = await this.ordemPagamentoAgrupadoService.getHistoricosOrdem(opa.id);
    if (historico) {
      this.ordemPagamentoAgrupadoService.saveStatusHistorico(historico[historico.length - 1], statusRemessa);
    }
  }

  private getHeaderName(consorcio: string[] | undefined): HeaderName {
    if (['VLT'].some(i => consorcio?.includes(i))) {
      return HeaderName.VLT;
    } else if (['STPC', 'STPL', 'TEC'].some(i => consorcio?.includes(i))) {
      return HeaderName.MODAL;
    } else {
      return HeaderName.CONSORCIO;
    }
  }

  private async criarHeaderLote(headerArquivo: HeaderArquivo, pagador: Pagador, formaPagamento: Cnab104FormaLancamento) {
    var headerLoteNew = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivo, pagador, formaPagamento);
    return await this.headerLoteService.saveDto(headerLoteNew);
  }

  async existsDetalheA(ultimoHistorico: OrdemPagamentoAgrupadoHistorico) {
    return await this.detalheAService.existsDetalheA(ultimoHistorico.id)
  }

  async debitarPagamentoIndevido(pagamentoIndevido: PagamentoIndevidoDTO, valor: any) {
    let aPagar = 0;
    var arr = Number(valor).toFixed(2);
    let result = pagamentoIndevido.saldoDevedor - Number(arr);
    let resultArr = result.toFixed(2);
    result = Number(resultArr);
    if (result > 0) {
      //Vanzeiro continua devendo
      //Atualizar o banco com o debito restante  
      pagamentoIndevido.saldoDevedor = result;
      pagamentoIndevido.dataReferencia = new Date();
      await this.pagamentoIndevidoService.save(pagamentoIndevido);

    } else {
      //debito encerrado
      if (result <= 0) {
        //ex: result = -10          
        //pagar diferença para o vanzeiro
        aPagar = Math.abs(result);
        pagamentoIndevido.saldoDevedor = 0;
        pagamentoIndevido.dataReferencia = new Date();
        //deletar debito do vanzeiro
        await this.pagamentoIndevidoService.save(pagamentoIndevido);
      }
    }

    return aPagar;
  }
}