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
  public async prepararRemessa(dataInicio: Date, dataFim: Date, dataPgto?: Date, consorcio?: string[], pagamentoUnico?: boolean, isPedente = false) {
    let ordens;
    if (pagamentoUnico) {
      ordens = await this.ordemPagamentoAgrupadoService.getOrdensUnicas(dataInicio, dataFim,
        dataPgto ? dataPgto : new Date());
    } if (isPedente) {
      ordens = await this.ordemPagamentoAgrupadoService.getOrdens(dataInicio, dataFim, consorcio, dataPgto);
    } else {
      ordens = await this.ordemPagamentoAgrupadoService.getOrdens(dataInicio, dataFim, consorcio);
    }

    if (ordens.length > 0) {
      const pagador = await this.pagadorService.getOneByIdPagador(ordens[0].pagadorId)
      if (!isEmpty(ordens)) {
        const headerArquivo = await this.gerarHeaderArquivo(pagador, this.getHeaderName(consorcio));
        let nsrTed = 1;
        let nsrCC = 1;
        for (let i = 0; i < ordens.length; i++) {
          let op;
          if (pagamentoUnico) {
            op = await this.ordemPagamentoAgrupadoService.getOrdemPagamentoUnico(ordens[i].id);
          } else {
            op = await this.ordemPagamentoAgrupadoService.getOrdemPagamento(ordens[i].id);
          }

          if (op != null) {
            let user
            if (pagamentoUnico) {
              user = await this.userService.getOne({ permitCode: op.idOperadora });
            } else {
              user = await this.userService.getOne({ id: op.userId });
            }
            if (user.bankCode) {
              const indevido = await this.pagamentoIndevidoService.findByNome(user.fullName);

              const headerLote = await this.gerarHeaderLote(headerArquivo, pagador, user.bankCode);
              let detB;
              let opa;
              if (pagamentoUnico) {
                opa = await this.ordemPagamentoAgrupadoService.getOrdemPagamentoAgrupado(Number(op.idOrdemPagamento));
              } else {
                opa = op.ordemPagamentoAgrupado;
              }

              if (headerLote) {
                if (headerLote.formaLancamento === '41') {
                  detB = await this.gerarDetalheAB(headerLote, opa, nsrTed, indevido ? indevido[0] : indevido, pagamentoUnico);
                  if (detB !== null) {
                    this.atualizaStatusRemessa(ordens[i], StatusRemessaEnum.PreparadoParaEnvio);
                    this.logger.debug(`Remessa preparado para: ${user.fullName} - TED`);
                    nsrTed = detB.nsr + 1;
                  }
                } else {
                  detB = await this.gerarDetalheAB(headerLote, opa, nsrCC, indevido ? indevido[0] : indevido, pagamentoUnico);
                  if (detB !== null) {
                    this.atualizaStatusRemessa(ordens[i], StatusRemessaEnum.PreparadoParaEnvio);
                    this.logger.debug(`Remessa preparado para: ${user.fullName} - CC`);
                    nsrCC = detB.nsr + 1;
                  }
                }
              }
            }
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

  private async gerarListaCnab(headerArquivoCnab, headerArquivo: HeaderArquivo, pagamentoUnico?: boolean) {
    const listCnab: ICnabInfo[] = [];

    const trailerArquivo104 = structuredClone(Cnab104PgtoTemplates.file104.registros.trailerArquivo);

    const registros: CnabRegistros104Pgto[] = [];

    const headersLote = await this.headerLoteService.findAll(headerArquivo.id);

    for (let i = 0; i < headersLote.length; i++) {

      const detalhesA = await this.detalheAService.getDetalheAHeaderLote(headersLote[i].id);

      for (let index = 0; index < detalhesA.length; index++) {

        this.logger.debug(`NSR: ${detalhesA[index].nsr}`)

        const historico = await this.ordemPagamentoAgrupadoService.getHistoricosOrdemDetalheA(detalhesA[index].id, pagamentoUnico);

        this.logger.debug(`BANK: ${historico.userBankCode} - ${historico.username}`)

        const detalheB = await this.detalheBService.findDetalheBDetalheAId(detalhesA[index].id);

        const detalhes = await DetalhesToCnab.convert(detalhesA[index], detalheB, historico);

        registros.push(detalhes);

      }
    }

    const cnab104 = new CnabFile104PgtoDTO({
      headerArquivo: headerArquivoCnab,
      lotes: headersLote.map((headerLote: HeaderLote) => ({
        headerLote: CnabHeaderLote104PgtoDTO.convert(headerLote, headerArquivo),
        registros: headerLote.formaLancamento === '41' ?//TED ou CC
          registros.filter(r => (r.detalheA.codigoBancoDestino.value !== '104')) : //Diferente de Caixa
          registros.filter(r => (r.detalheA.codigoBancoDestino.value === '104')),
        trailerLote: structuredClone(Cnab104PgtoTemplates.file104.registros.trailerLote),
      })),
      trailerArquivo: trailerArquivo104,
    });

    if (cnab104) {
      const [cnabStr] = stringifyCnab104File(cnab104, true, 'CnabPgtoRem');
      if (!cnabStr) {
        this.logger.warn(`Não foi gerado um cnabString - headerArqId: ${headerArquivo.id}`);
      }
      listCnab.push({ name: '', content: cnabStr, headerArquivo: headerArquivo });
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
    const headerArquivoExists =
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
      const headerLote = headersLote.filter((h: { formaLancamento: Cnab104FormaLancamento; }) =>
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

  private async gerarDetalheAB(headerLote: HeaderLote, ordem: OrdemPagamentoAgrupado, nsr: number,
    indevido?: PagamentoIndevidoDTO, pagamentoUnico?: boolean) {
    let ultimoHistorico;
    if (pagamentoUnico) {
      ultimoHistorico = await this.ordemPagamentoAgrupadoService.getHistoricoUnico(ordem.id);
    } else {
      ultimoHistorico = ordem.ordensPagamentoAgrupadoHistorico[ordem.ordensPagamentoAgrupadoHistorico.length - 1];
    }

    const detalheA = await this.existsDetalheA(ultimoHistorico)

    const numeroDocumento = await this.detalheAService.getNextNumeroDocumento(new Date());
    const detalheADTO = await HeaderLoteToDetalheA.convert(headerLote, ordem, nsr, ultimoHistorico, numeroDocumento);

    if (detalheA.length > 0) {
      detalheADTO.id = detalheA[0].id;
      detalheADTO.valorRealEfetivado = detalheA[0].valorLancamento;
    }

    if (indevido && indevido.saldoDevedor > 0) {
      const valor = await this.debitarPagamentoIndevido(indevido, detalheADTO.valorLancamento);
      detalheADTO.valorLancamento = valor;
      detalheADTO.valorRealEfetivado = valor;
    }

    const detalheASavesd = await this.detalheAService.save(detalheADTO);
    if (detalheASavesd) {
      const detalheB = DetalheAToDetalheB.convert(detalheASavesd, ordem);
      return await this.detalheBService.save(detalheB);
    }
    return null;
  }

  private async atualizaStatusRemessa(opa: OrdemPagamentoAgrupado, statusRemessa: StatusRemessaEnum) {
    const historico = await this.ordemPagamentoAgrupadoService.getHistoricosOrdem(opa.id);
    if (historico) {
      this.ordemPagamentoAgrupadoService.saveStatusHistorico(historico[historico.length - 1], statusRemessa);
    }
  }

  private getHeaderName(consorcio: string[] | undefined): HeaderName {
    if (['STPC', 'STPL', 'TEC'].some(i => consorcio?.includes(i))) {
      return HeaderName.MODAL;
    } else {
      return HeaderName.CONSORCIO;
    }
  }

  private async criarHeaderLote(headerArquivo: HeaderArquivo, pagador: Pagador, formaPagamento: Cnab104FormaLancamento) {
    const headerLoteNew = HeaderLoteDTO.fromHeaderArquivoDTO(headerArquivo, pagador, formaPagamento);
    return await this.headerLoteService.saveDto(headerLoteNew);
  }

  async existsDetalheA(ultimoHistorico: OrdemPagamentoAgrupadoHistorico) {
    return await this.detalheAService.existsDetalheA(ultimoHistorico.id)

  }

  async debitarPagamentoIndevido(pagamentoIndevido: PagamentoIndevidoDTO, valor: any) {
    let aPagar = 0;
    const arr = Number(valor).toFixed(2);
    let result = pagamentoIndevido.saldoDevedor - Number(arr);
    const resultArr = result.toFixed(2);
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
