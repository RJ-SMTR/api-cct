import { Injectable, Logger } from '@nestjs/common';
import { BanksService } from 'src/banks/banks.service';
import { SftpService } from 'src/sftp/sftp.service';
import { getDateFromString } from 'src/utils/date-utils';
import { asDate, asNullableStringDate, asNumber, asString } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Cnab104Const } from '../const/cnab-104.const';
import { DetalheADTO } from '../dto/detalhe-a.dto';
import { DetalheBDTO } from '../dto/detalhe-b.dto';
import { HeaderArquivoDTO } from '../dto/header-arquivo.dto';
import { ItemTransacao } from '../entity/item-transacao.entity';
import { Transacao } from '../entity/transacao.entity';
import { HeaderArquivoTipoArquivo } from '../enums/header-arquivo/header-arquivo-tipo-arquivo.enum';
import { ICnab240_104DetalheA } from '../interfaces/cnab-240/104/cnab-240-104-detalhe-a.interface';
import { ICnab240_104DetalheB } from '../interfaces/cnab-240/104/cnab-240-104-detalhe-b.interface';
import { ICnab240_104File } from '../interfaces/cnab-240/104/cnab-240-104-file.interface';
import { ICnab240_104HeaderArquivo } from '../interfaces/cnab-240/104/cnab-240-104-header-arquivo.interface';
import { ICnab240_104HeaderLote } from '../interfaces/cnab-240/104/cnab-240-104-header-lote.interface';
import { ICnab240_104RegistroAB } from '../interfaces/cnab-240/104/cnab-240-104-registro-a-b.interface';
import { ICnabTables } from '../interfaces/cnab-tables.interface';
import { HeaderArquivoRepository } from '../repository/header-arquivo.repository';
import { cnab240_104DetalheATemplate as detalheATemplate } from '../templates/cnab-240/104/cnab-240-104-detalhe-a-template.const';
import { cnab240_104DetalheBTemplate as detalheBTemplate } from '../templates/cnab-240/104/cnab-240-104-detalhe-b-template.const';
import { cnab240_104HeaderArquivoTemplate as headerArquivoTemplate } from '../templates/cnab-240/104/cnab-240-104-header-arquivo-template.const';
import { cnab240_104HeaderLoteTemplate as headerLoteTemplate } from '../templates/cnab-240/104/cnab-240-104-header-lote-template.const';
import { cnab240_104TrailerArquivoTemplate as trailerArquivoTemplate } from '../templates/cnab-240/104/cnab-240-104-trailer-arquivo-template.const';
import { cnab240_104TrailerLoteTemplate as trailerLoteTemplate } from '../templates/cnab-240/104/cnab-240-104-trailer-lote-template.const';
import {
  getProcessedCnab104,
  stringifyCnab104File,
} from '../utils/cnab-104-utils';
import { ArquivoPublicacaoDTO } from './../dto/arquivo-publicacao.dto';
import { HeaderLoteDTO } from './../dto/header-lote.dto';
import { HeaderArquivo } from './../entity/header-arquivo.entity';
import { ArquivoPublicacaoRepository } from './../repository/arquivo-publicacao.repository';
import { ClienteFavorecidoService } from './cliente-favorecido.service';
import { Cnab104Service } from './cnab-104.service';
import { DetalheAService } from './detalhe-a.service';
import { DetalheBService } from './detalhe-b.service';
import { HeaderLoteService } from './header-lote.service';
import { ItemTransacaoService } from './item-transacao.service';
import { PagadorService } from './pagador.service';
import { TransacaoService } from './transacao.service';

@Injectable()
export class HeaderArquivoService {
  private logger: Logger = new Logger('HeaderArquivoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoRepository: HeaderArquivoRepository,
    private arquivoPublicacaoRepository: ArquivoPublicacaoRepository,
    private transacaoService: TransacaoService,
    private headerLoteService: HeaderLoteService,
    private itemTransacaoService: ItemTransacaoService,
    private pagadorService: PagadorService,
    private detalheAService: DetalheAService,
    private detalheBService: DetalheBService,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private cnab104Service: Cnab104Service,
    private banksService: BanksService,
    private sftpService: SftpService
  ) { }

  public async saveRemessa(cnabTables: ICnabTables) {
    const headerLote = cnabTables.lotes[0].headerLote;
    const detalhes = cnabTables.lotes[0].detalhes;
    await this.headerArquivoRepository.save(cnabTables.headerArquivo);
    await this.headerLoteService.save(headerLote);
    for (const { itemTransacao, registroAB } of detalhes) {
      await this.saveDetalhes(itemTransacao, headerLote, registroAB);
    }
  }

  public async generateCnab(transacao: Transacao): Promise<{
    cnabString: string;
    cnabTables: ICnabTables;
  }> {
    // get variables
    const headerArquivoDTO = await this.getHeaderArquivoDTOFromTransacao(
      transacao,
      HeaderArquivoTipoArquivo.Remessa,
    );
    const headerLoteDTO = this.transacaoToHeaderLoteDTO(
      transacao,
      headerArquivoDTO,
    );

    const headerArquivo104 = await this.getHeaderArquivo104(headerArquivoDTO);
    const trailerArquivo104 = structuredClone(trailerArquivoTemplate);

    // mount file and tables
    const cnab104: ICnab240_104File = {
      headerArquivo: headerArquivo104,
      lotes: [
        {
          headerLote: this.getHeaderLote104(headerLoteDTO),
          registros: [],
          trailerLote: structuredClone(trailerLoteTemplate),
        },
      ],
      trailerArquivo: trailerArquivo104,
    };
    const cnabTables: ICnabTables = {
      headerArquivo: headerArquivoDTO,
      lotes: [
        {
          headerLote: headerLoteDTO,
          detalhes: [],
        },
      ],
    };

    // mount file details
    const listItem = await this.itemTransacaoService.findManyByIdTransacao(
      transacao.id,
    );
    for (const itemTransacao of listItem) {
      cnab104.lotes[0].registros.push(
        this.getDetalhes104(itemTransacao, headerLoteDTO),
      );
    }

    // process file
    const processedCnab104 = getProcessedCnab104(cnab104);
    const cnabString = stringifyCnab104File(cnab104);

    // update cnabTables
    this.updateHeaderLoteDTOFrom104(
      cnabTables.lotes[0].headerLote,
      processedCnab104.lotes[0].headerLote,
    );
    for (let i = 0; i < listItem.length; i++) {
      const itemTransacao = listItem[i];
      cnabTables.lotes[0].detalhes.push({
        itemTransacao: itemTransacao,
        registroAB: processedCnab104.lotes[0].registros[i] as ICnab240_104RegistroAB,
      });
    }

    return {
      cnabString: cnabString,
      cnabTables: cnabTables,
    };
  }

  public async getHeaderArquivo104(
    headerArquivoDTO: HeaderArquivoDTO,
  ): Promise<ICnab240_104HeaderArquivo> {
    const bank = await this.banksService.getOne({
      code: Number(headerArquivoDTO.codigoBanco),
    });

    const headerArquivo104: ICnab240_104HeaderArquivo = structuredClone(
      headerArquivoTemplate,
    );
    headerArquivo104.codigoBanco.value = headerArquivoDTO.codigoBanco;
    headerArquivo104.numeroInscricao.value = headerArquivoDTO.numeroInscricao;
    headerArquivo104.codigoConvenioBanco.value = headerArquivoDTO.codigoConvenio;
    headerArquivo104.parametroTransmissao.value =
      headerArquivoDTO.parametroTransmissao;
    headerArquivo104.ambienteCliente.value =
      this.cnab104Service.getCnab104ClienteCaixa();
    headerArquivo104.agenciaContaCorrente.value = headerArquivoDTO.agencia;
    headerArquivo104.numeroConta.value = headerArquivoDTO.numeroConta;
    headerArquivo104.dvAgencia.value = headerArquivoDTO.dvAgencia;
    headerArquivo104.dvConta.value = headerArquivoDTO.dvConta;
    headerArquivo104.nomeEmpresa.value = headerArquivoDTO.nomeEmpresa;
    headerArquivo104.nomeBanco.value = bank.name;
    headerArquivo104.tipoArquivo.value = headerArquivoDTO.tipoArquivo;
    headerArquivo104.dataGeracaoArquivo.value = headerArquivoDTO.dataGeracao;
    headerArquivo104.horaGeracaoArquivo.value = headerArquivoDTO.horaGeracao;

    return headerArquivo104;
  }

  public getHeaderLote104(
    headerLoteDTO: HeaderLoteDTO,
  ): ICnab240_104HeaderLote {
    const headerLote104: ICnab240_104HeaderLote =
      structuredClone(headerLoteTemplate);
    headerLote104.codigoConvenioBanco.value = headerLoteDTO.codigoConvenioBanco;
    headerLote104.numeroInscricao.value = headerLoteDTO.numeroInscricao;
    headerLote104.agenciaContaCorrente.value = headerLoteDTO.numeroInscricao;
    headerLote104.parametroTransmissao.value = headerLoteDTO.parametroTransmissao;
    headerLote104.tipoInscricao.value = headerLoteDTO.tipoInscricao;

    return headerLote104;
  }

  /**
   * Get Cnab 240 DetalheA, DetalheB for Caixa
   * 
   * indicadorBloqueio = DataFixa (see `detalheATemplate`)
   */
  public getDetalhes104(
    itemTransacao: ItemTransacao,
    headerLoteDTO: HeaderLoteDTO,
  ): ICnab240_104RegistroAB {
    const detalheA: ICnab240_104DetalheA = structuredClone(detalheATemplate);
    detalheA.dataEfetivacao.value = itemTransacao.dataTransacao;
    detalheA.dataVencimento.value = itemTransacao.dataProcessamento;
    detalheA.loteServico.value = headerLoteDTO.loteServico;
    detalheA.periodoDiaVencimento.value = itemTransacao.dataProcessamento;
    detalheA.valorLancamento.value = itemTransacao.valor;
    detalheA.valorRealEfetivado.value = itemTransacao.valor;

    const detalheB: ICnab240_104DetalheB = structuredClone(detalheBTemplate);
    detalheB.dataVencimento.value = itemTransacao.dataProcessamento;

    return {
      detalheA: detalheA,
      detalheB: detalheB,
    };
  }

  public async findOne(
    fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
  ): Promise<Nullable<HeaderArquivo>> {
    return await this.headerArquivoRepository.getOne(fields);
  }

  public async findAll(): Promise<HeaderArquivo[]> {
    return await this.headerArquivoRepository.findAll({});
  }

  private async getHeaderArquivoDTOFromTransacao(
    transacao: Transacao,
    tipo_arquivo: HeaderArquivoTipoArquivo,
  ): Promise<HeaderArquivoDTO> {
    const dto = new HeaderArquivoDTO();
    const pagador = await this.pagadorService.getOneByIdPagador(transacao.pagador.id);
    dto.agencia = asString(pagador.agencia, 'agencia');
    dto.codigoBanco = String(headerArquivoTemplate.codigoBanco.value);
    dto.codigoConvenio = String(headerArquivoTemplate.codigoConvenioBanco.value);
    dto.dataGeracao = asDate(transacao.dataOrdem, 'dataGeracao');
    dto.horaGeracao = asDate(transacao.dataOrdem, 'horaGeracao');
    dto.dvAgencia = asString(pagador.dvAgencia, 'dvAgencia');
    dto.dvConta = asString(pagador.dvConta, 'dvConta');
    dto.transacao = transacao;
    dto.nomeEmpresa = pagador.nomeEmpresa;
    dto.numeroConta = asString(pagador.conta, 'numeroConta');
    dto.numeroInscricao = asString(pagador.cpfCnpj, 'numeroInscricao');
    dto.parametroTransmissao = asString(
      headerArquivoTemplate.parametroTransmissao.value, 'parametroTransmissao',
    );
    dto.tipoArquivo = tipo_arquivo;
    dto.tipoInscricao = String(headerArquivoTemplate.tipoInscricao.value);
    return dto;
  }

  private updateHeaderLoteDTOFrom104(
    headerLoteDTO: HeaderLoteDTO,
    headerLote104: ICnab240_104HeaderLote,
  ) {
    headerLoteDTO.loteServico = String(headerLote104.loteServico.value);
  }

  private transacaoToHeaderLoteDTO(
    transacao: Transacao,
    headerArquivoDTO: HeaderArquivoDTO,
  ): HeaderLoteDTO {
    const dto = new HeaderLoteDTO();
    dto.codigoConvenioBanco = headerArquivoDTO.codigoConvenio;
    dto.headerArquivo = headerArquivoDTO;
    dto.pagador = transacao.pagador;
    dto.numeroInscricao = headerArquivoDTO.numeroInscricao;
    dto.parametroTransmissao = headerArquivoDTO.parametroTransmissao;
    dto.tipoCompromisso = String(headerLoteTemplate.tipoCompromisso.value);
    dto.tipoInscricao = headerArquivoDTO.tipoInscricao;
    return dto;
  }

  public async saveDetalhes(
    itemTransacao: ItemTransacao,
    headerLoteDTO: HeaderLoteDTO,
    registroAB: ICnab240_104RegistroAB,
  ): Promise<void> {
    const dataTransacao = itemTransacao.dataTransacao;

    const detalheA = new DetalheADTO();
    detalheA.dataEfetivacao = dataTransacao;
    detalheA.dataVencimento = asDate(itemTransacao.dataProcessamento);
    detalheA.headerLote = headerLoteDTO;
    detalheA.indicadorBloqueio = String(
      registroAB.detalheA.indicadorBloqueio.value,
    );
    detalheA.clienteFavorecido = itemTransacao.clienteFavorecido;
    detalheA.indicadorFormaParcelamento = String(
      detalheATemplate.indicadorFormaParcelamento.value,
    );
    detalheA.loteServico = headerLoteDTO.loteServico;
    detalheA.numeroDocumentoLancamento =
      await this.detalheAService.getNextNumeroDocumento(dataTransacao);
    detalheA.periodoVencimento = asDate(itemTransacao.dataProcessamento);
    detalheA.numeroParcela = Number(registroAB.detalheA.numeroParcela.value);
    detalheA.quantidadeParcelas = Number(
      registroAB.detalheA.quantidadeParcelas.value,
    );
    detalheA.tipoFinalidadeConta = String(
      registroAB.detalheA.finalidadeDOC.value,
    );
    detalheA.tipoMoeda = String(registroAB.detalheA.tipoMoeda.value);
    detalheA.quantidadeMoeda = Number(registroAB.detalheA.quantidadeMoeda.value);
    detalheA.valorLancamento = asNumber(itemTransacao.valor);
    detalheA.valorRealEfetivado = asNumber(itemTransacao.valor);
    const saveDetalheA = await this.detalheAService.save(detalheA);

    const detalheB = new DetalheBDTO();
    detalheB.dataVencimento = asDate(itemTransacao.dataProcessamento);
    detalheB.nsr = Number(registroAB.detalheB.nsr.value);
    detalheB.detalhe_a = { id: saveDetalheA.id };
    await this.detalheBService.save(detalheB);
  }
  public async headerArquivoExists(id_transacao: number): Promise<boolean> {
    const ret = await this.headerArquivoRepository.getOne({
      transacao: { id: id_transacao },
    });
    if (ret == null) {
      return false;
    }
    return true;
  }

  public async saveArquivoRetorno(Cnab240: ICnab240_104File): Promise<void> {
    const headerArquivo = new HeaderArquivo();
    headerArquivo.codigoBanco = String(Cnab240.headerArquivo.codigoBanco.value);
    headerArquivo.agencia = String(Cnab240.headerArquivo.agenciaContaCorrente.value);
    headerArquivo.numeroConta = String(Cnab240.headerArquivo.numeroConta.value);
    headerArquivo.dvConta = String(Cnab240.headerArquivo.dvConta.value);
    headerArquivo.dataGeracao = getDateFromString(Cnab240.headerArquivo.dataGeracaoArquivo.value, Cnab104Const.cnabDateOutput);
    headerArquivo.nomeEmpresa = String(Cnab240.headerArquivo.nomeEmpresa.value);
    headerArquivo.nsa = Number(Cnab240.headerArquivo.nsa.value);
    headerArquivo.parametroTransmissao = String(Cnab240.headerArquivo.parametroTransmissao.value);
    headerArquivo.tipoArquivo = "retorno";
    headerArquivo.tipoInscricao = String(Cnab240.headerArquivo.tipoInscricao.value);
    headerArquivo.numeroInscricao = String(Cnab240.headerArquivo.numeroInscricao.value);

    const headerArquivoRemessa = await this.headerArquivoRepository.getOne({
      nsa: Number(Cnab240.headerArquivo.nsa.value),
      tipoArquivo: "remessa"
    });

    headerArquivo.transacao = ({ id: headerArquivoRemessa.transacao.id } as Transacao);
    const headerArquivoSave = await this.headerArquivoRepository.save(headerArquivo);
    Cnab240.lotes.forEach(async l => {
      const headerLote = new HeaderLoteDTO();

      headerLote.id = headerArquivoSave.id;
      headerLote.loteServico = asString(l.headerLote.loteServico.value, 'loteServico');
      headerLote.codigoConvenioBanco = asString(l.headerLote.codigoConvenioBanco.value, 'codigoConvenioBanco');
      headerLote.numeroInscricao = asString(l.headerLote.numeroInscricao.value, 'numeroInscricao');
      headerLote.parametroTransmissao = asString(l.headerLote.param_transmissao.value, 'parametroTransmissao');
      headerLote.tipoCompromisso = l.headerLote.tipoCompromisso.value;
      headerLote.tipoInscricao = l.headerLote.tipoInscricao.value;

      const pagador = await this.pagadorService.getByConta(l.headerLote.numeroConta.value);
      headerLote.pagador = { id: pagador.id };
      const headerLoteSave = await this.headerLoteService.save(headerLote);
      l.registros.forEach(async registro => {
        const r = (registro as ICnab240_104RegistroAB);
        const detalheA = new DetalheADTO();
        detalheA.headerLote = { id: headerLoteSave.id };
        detalheA.dataEfetivacao = getDateFromString(r.detalheA.dataEfetivacao.value, Cnab104Const.dateObjOutput);
        detalheA.dataVencimento = asNullableStringDate(r.detalheA.dataVencimento.value);
        detalheA.indicadorBloqueio = r.detalheA?.indicadorBloqueio.value;
        detalheA.indicadorFormaParcelamento = asString(r.detalheA?.indicadorFormaParcelamento.value, 'indicadorFormaParcelamento');
        detalheA.loteServico = asString(r.detalheA?.loteServico.value, 'loteServico');
        detalheA.nsr = Number(asString(r.detalheA.nsr.value));
        detalheA.numeroDocumentoLancamento = Number(asString(r.detalheA?.numeroDocumento.value));
        detalheA.numeroParcela = Number(asString(r.detalheA?.numeroParcela.value));
        detalheA.periodoVencimento = getDateFromString(r.detalheA?.dataVencimento.value, Cnab104Const.dateObjOutput);
        detalheA.quantidadeMoeda = asNumber(r.detalheA?.quantidadeMoeda.value);
        detalheA.quantidadeParcelas = asNumber(r.detalheA?.quantidadeMoeda.value);
        detalheA.valorLancamento = asNumber(r.detalheA?.valor_lancamento.value);
        detalheA.tipoFinalidadeConta = asString(r.detalheA?.tipoContaFinalidade.value, 'tipoFinalidadeConta');
        detalheA.tipoMoeda = asString(r.detalheA?.tipoMoeda.value, 'tipoMoeda');
        detalheA.valorRealEfetivado = asNumber(r.detalheA?.valorRealEfetivado.value);

        const cliente =
          await this.clienteFavorecidoService.getOne(
            {
              contaCorrente: r.detalheA.contaCorrenteDestino.value,
              dvContaCorrente: r.detalheA.dvContaDestino.value
            });

        detalheA.clienteFavorecido = { id: cliente.id };

        const detalheASave = await this.detalheAService.save(detalheA);

        const detalheB = new DetalheBDTO();
        detalheB.detalhe_a = { id: detalheASave.id };
        detalheB.nsr = r.detalheB.nsr.value;
        detalheB.dataVencimento = getDateFromString(r.detalheB.dataVencimento.value, Cnab104Const.dateObjOutput);
        await this.detalheBService.save(detalheB);
      });
    })
  }


  public async compareRemessaToRetorno(): Promise<void> {
    const arquivosRemessa = await this.headerArquivoRepository.findAll({ tipoArquivo: "remessa" });

    arquivosRemessa.forEach(async headerArquivo => {
      const arquivoPublicacao = new ArquivoPublicacaoDTO();
      arquivoPublicacao.idHeaderArquivo = headerArquivo.id
      arquivoPublicacao.idTransacao = headerArquivo.transacao.id;
      arquivoPublicacao.dataGeracaoRemessa = asDate(headerArquivo.dataGeracao);
      arquivoPublicacao.horaGeracaoRemessa = asDate(headerArquivo.dataGeracao);
      const arquivosRetorno =
        await this.headerArquivoRepository.findAll({ tipoArquivo: "retorno", nsa: headerArquivo.nsa });
      if (arquivosRetorno != null) {
        //Header Arquivo Retorno
        arquivosRetorno.forEach(async arquivoRetorno => {
          const headersLoteRetorno =
            await this.headerLoteService.findMany({ id: arquivoRetorno.id });
          arquivoPublicacao.dataGeracaoRetorno = asDate(arquivoRetorno.dataGeracao);
          arquivoPublicacao.horaGeracaoRetorno = asDate(arquivoRetorno.horaGeracao);
          //Header lote Retorno
          headersLoteRetorno.forEach(async headerLoteRetorno => {
            //DetalheA Retorno
            const detalhesA = await this.detalheAService.findMany({ id: headerLoteRetorno.id });
            detalhesA.forEach(async detalheA => {
              arquivoPublicacao.loteServico = asString(detalheA.loteServico, 'loteServico');
              arquivoPublicacao.dataVencimento = asDate(detalheA.dataVencimento, 'dataVencimento');
              arquivoPublicacao.valorLancamento = asNumber(detalheA.valorLancamento, 'valorLancamento');
              arquivoPublicacao.dataEfetivacao = asDate(detalheA.dataEfetivacao, 'dataEfetivacao');
              arquivoPublicacao.valorRealEfetivado = asNumber(detalheA.valorRealEfetivado, 'valorRealEfetivado');
              const clienteFavorecido =
                await this.clienteFavorecidoService.getOneByIdClienteFavorecido(detalheA.clienteFavorecido.id);
              arquivoPublicacao.nomeCliente = clienteFavorecido.nome;
              arquivoPublicacao.cpfCnpjCliente = asString(clienteFavorecido.cpfCnpj, 'cpfCnpj');
              arquivoPublicacao.codBancoCliente = asString(clienteFavorecido.codigoBanco, 'codigoBanco');
              arquivoPublicacao.agenciaCliente = asString(clienteFavorecido.agencia, 'agencia');
              arquivoPublicacao.dvAgenciaCliente = asString(clienteFavorecido.dvAgencia, 'dvAgencia');
              arquivoPublicacao.contaCorrenteCliente = asString(clienteFavorecido.contaCorrente, 'contaCorrente');
              arquivoPublicacao.dvContaCorrenteCliente = asString(clienteFavorecido.dvContaCorrente, 'dvContaCorrente');
              arquivoPublicacao.ocorrencias = asString(detalheA.ocorrencias, 'ocorrencias');
              void this.arquivoPublicacaoRepository.save(arquivoPublicacao);
            });
          });
        });
      }
    });
  }

  /**
   * Get the most recent CNAB Retorno Date saved in database.
   */
  public async getMostRecentRetornoDate(): Promise<Date> {
    const retorno = await this.headerArquivoRepository.getOne(
      { tipoArquivo: HeaderArquivoTipoArquivo.Retorno },
      { createdAt: 'DESC' }
    );
    return retorno?.createdAt || new Date(0);
  }
}

