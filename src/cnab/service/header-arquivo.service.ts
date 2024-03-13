import { Injectable, Logger } from '@nestjs/common';
import { format } from 'date-fns';
import { BanksService } from 'src/banks/banks.service';
import { SftpService } from 'src/sftp/sftp.service';
import { asDate, asNumber, asString, asStringDate } from 'src/utils/pipe-utils';
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
import { getNumberFromCnabField } from '../utils/cnab-field-utils';
import { getTipoInscricao } from '../utils/cnab-utils';
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
    const savedHeaderArquivo = await this.headerArquivoRepository.save(cnabTables.headerArquivo);
    this.updateHeaderLoteDTOFromHeaderArquivo(headerLote, savedHeaderArquivo);
    await this.headerLoteService.save(headerLote);
    for (const { itemTransacao, registroAB } of detalhes) {
      await this.saveRemessaDetalhes(itemTransacao, headerLote, registroAB);
    }
  }

  private updateHeaderLoteDTOFromHeaderArquivo(headerLoteDTO: HeaderLoteDTO, headerArquivo: HeaderArquivo) {
    headerLoteDTO.headerArquivo = { id: headerArquivo.id };
  }

  public async generateCnab(transacao: Transacao): Promise<{
    cnabString: string;
    cnabTables: ICnabTables;
  }> {
    // Get DTO
    const now = new Date();
    const headerArquivoDTO = await this.getHeaderArquivoDTOFromTransacao(
      transacao,
      HeaderArquivoTipoArquivo.Remessa,
    );
    const headerLoteDTO = this.getHeaderLoteDTOFromTransacao(
      transacao,
      headerArquivoDTO,
    );

    // Get 104
    const headerArquivo104 = await this.getHeaderArquivo104(headerArquivoDTO);
    const trailerArquivo104 = structuredClone(trailerArquivoTemplate);

    // mount file104
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

    // mount file104 details
    const listItem = await this.itemTransacaoService.findManyByIdTransacao(
      transacao.id,
    );
    let numeroDocumento = await this.getNextNumeroDocumento(now);
    for (const itemTransacao of listItem) {
      cnab104.lotes[0].registros.push(
        this.getDetalhes104(itemTransacao, numeroDocumento),
      );
      numeroDocumento++;
    }

    // process file104
    const processedCnab104 = getProcessedCnab104(cnab104);
    const cnabString = stringifyCnab104File(cnab104);

    // Mount cnabTablesDTO
    this.updateHeaderArquivoDTOFrom104(headerArquivoDTO, processedCnab104.headerArquivo);
    this.updateHeaderLoteDTOFrom104(
      headerLoteDTO,
      processedCnab104.lotes[0].headerLote,
    );
    const cnabTables: ICnabTables = {
      headerArquivo: headerArquivoDTO,
      lotes: [
        {
          headerLote: headerLoteDTO,
          detalhes: [],
        },
      ],
    };

    // Mount cnabTablesDTO detalhes
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
    headerArquivo104.nsa.value = headerArquivoDTO.nsa;

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
   * 
   * @param numeroDocumento Atribuído pela empresa. Deve ser um número novo.
   */
  public getDetalhes104(
    itemTransacao: ItemTransacao,
    numeroDocumento: number,
  ): ICnab240_104RegistroAB {
    const detalheA: ICnab240_104DetalheA = structuredClone(detalheATemplate);
    detalheA.codigoBancoDestino.value = itemTransacao.clienteFavorecido.codigoBanco;
    detalheA.codigoAgenciaDestino.value = itemTransacao.clienteFavorecido.agencia;
    detalheA.dvAgenciaDestino.value = itemTransacao.clienteFavorecido.dvAgencia;
    detalheA.contaCorrenteDestino.value = itemTransacao.clienteFavorecido.contaCorrente;
    detalheA.dvContaDestino.value = itemTransacao.clienteFavorecido.dvContaCorrente;
    detalheA.nomeTerceiro.value = itemTransacao.clienteFavorecido.nome;
    detalheA.numeroDocumentoEmpresa.value = numeroDocumento;
    detalheA.dataVencimento.value = itemTransacao.dataProcessamento;
    // indicadorFormaParcelamento = DataFixa
    detalheA.periodoDiaVencimento.value = format(itemTransacao.dataProcessamento, 'dd');
    detalheA.valorLancamento.value = itemTransacao.valor;

    const detalheB: ICnab240_104DetalheB = structuredClone(detalheBTemplate);
    detalheB.tipoInscricao.value = getTipoInscricao(asString(itemTransacao.clienteFavorecido.cpfCnpj));
    detalheB.numeroInscricao.value = asString(itemTransacao.clienteFavorecido.cpfCnpj);
    detalheB.dataVencimento.value = detalheA.dataVencimento.value;

    return {
      detalheA: detalheA,
      detalheB: detalheB,
    };
  }

  public async findOne(
    fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
  ): Promise<Nullable<HeaderArquivo>> {
    return await this.headerArquivoRepository.findOne(fields);
  }

  public async findAll(): Promise<HeaderArquivo[]> {
    return await this.headerArquivoRepository.findAll({});
  }

  private async getHeaderArquivoDTOFromTransacao(
    transacao: Transacao,
    tipo_arquivo: HeaderArquivoTipoArquivo,
  ): Promise<HeaderArquivoDTO> {
    const now = new Date();
    const dto = new HeaderArquivoDTO();
    const pagador = await this.pagadorService.getOneByIdPagador(transacao.pagador.id);
    dto.agencia = String(pagador.agencia);
    dto.codigoBanco = String(headerArquivoTemplate.codigoBanco.value);
    dto.tipoInscricao = String(headerArquivoTemplate.tipoInscricao.value);
    dto.numeroInscricao = String(pagador.cpfCnpj);
    dto.codigoConvenio = String(headerArquivoTemplate.codigoConvenioBanco.value);
    dto.parametroTransmissao = String(
      headerArquivoTemplate.parametroTransmissao.value,
    );
    dto.dataGeracao = now;
    dto.horaGeracao = now;
    dto.dvAgencia = String(pagador.dvAgencia);
    dto.dvConta = String(pagador.dvConta);
    dto.transacao = transacao;
    dto.nomeEmpresa = pagador.nomeEmpresa;
    dto.numeroConta = String(pagador.conta);
    dto.tipoArquivo = tipo_arquivo;
    dto.nsa = await this.getNextNSA();
    return dto;
  }

  private updateHeaderArquivoDTOFrom104(
    headerArquivoDTO: HeaderArquivoDTO,
    headerArquivo104: ICnab240_104HeaderArquivo,
  ) {
    headerArquivoDTO.nsa = Number(headerArquivo104.nsa.value);
  }

  private updateHeaderLoteDTOFrom104(
    headerLoteDTO: HeaderLoteDTO,
    headerLote104: ICnab240_104HeaderLote,
  ) {
    headerLoteDTO.loteServico = String(headerLote104.loteServico.value);
  }

  private getHeaderLoteDTOFromTransacao(
    transacao: Transacao,
    headerArquivoDTO: HeaderArquivoDTO,
  ): HeaderLoteDTO {
    const dto = new HeaderLoteDTO();
    dto.codigoConvenioBanco = headerArquivoDTO.codigoConvenio;
    dto.pagador = { id: transacao.pagador.id };
    dto.numeroInscricao = headerArquivoDTO.numeroInscricao;
    dto.parametroTransmissao = headerArquivoDTO.parametroTransmissao;
    dto.tipoCompromisso = String(headerLoteTemplate.tipoCompromisso.value);
    dto.tipoInscricao = headerArquivoDTO.tipoInscricao;
    return dto;
  }

  /**
   * @param headerLoteDTO filled DTO with ID
   * @param registroAB filled registroAB
   */
  public async saveRemessaDetalhes(
    itemTransacao: ItemTransacao,
    headerLoteDTO: HeaderLoteDTO,
    registroAB: ICnab240_104RegistroAB,
  ): Promise<void> {
    const r = registroAB;

    const detalheA = new DetalheADTO();
    // TODO: A dataEfetivação deveria ser null na remessa
    detalheA.headerLote = { id: headerLoteDTO.id };
    detalheA.clienteFavorecido = { id: itemTransacao.clienteFavorecido.id };
    detalheA.loteServico = Number(r.detalheA.loteServico.value);
    detalheA.finalidadeDOC = String(r.detalheA.finalidadeDOC.value);
    detalheA.numeroDocumentoEmpresa = Number(r.detalheA.numeroDocumentoEmpresa.value);
    detalheA.dataVencimento = asDate(new Date(r.detalheA.dataVencimento.value));
    detalheA.tipoMoeda = String(r.detalheA.tipoMoeda.value);
    detalheA.quantidadeMoeda = Number(r.detalheA.quantidadeMoeda.value);
    detalheA.valorLancamento = getNumberFromCnabField(r.detalheA.valorLancamento);
    detalheA.numeroDocumentoBanco = Number(r.detalheA.numeroDocumentoBanco.value);
    detalheA.quantidadeParcelas = Number(r.detalheA.quantidadeParcelas.value);
    detalheA.indicadorBloqueio = String(r.detalheA.indicadorBloqueio.value);
    detalheA.indicadorFormaParcelamento = String(
      r.detalheA.indicadorFormaParcelamento.value,
    );
    detalheA.periodoVencimento = asDate(itemTransacao.dataProcessamento);
    detalheA.numeroParcela = Number(r.detalheA.numeroParcela.value);
    detalheA.dataEfetivacao = null;
    detalheA.valorRealEfetivado = null;
    detalheA.nsr = Number(r.detalheA.nsr.value);
    const saveDetalheA = await this.detalheAService.save(detalheA);

    const detalheB = new DetalheBDTO();
    detalheB.dataVencimento = asDate(itemTransacao.dataProcessamento);
    detalheB.nsr = Number(r.detalheB.nsr.value);
    detalheB.detalheA = { id: saveDetalheA.id };
    await this.detalheBService.save(detalheB);
  }
  public async headerArquivoExists(id_transacao: number): Promise<boolean> {
    const header = await this.headerArquivoRepository.findOne({
      transacao: { id: id_transacao },
    });
    if (header == null) {
      return false;
    }
    return true;
  }

  /**
   * @throws `HttpException` if pipe fails or other problem
   */
  public async saveArquivoRetorno(Cnab240: ICnab240_104File): Promise<void> {
    const headerArquivo = new HeaderArquivo();
    headerArquivo.codigoBanco = String(Cnab240.headerArquivo.codigoBanco.value);
    headerArquivo.agencia = String(Cnab240.headerArquivo.agenciaContaCorrente.value);
    headerArquivo.numeroConta = String(Cnab240.headerArquivo.numeroConta.value);
    headerArquivo.dvConta = String(Cnab240.headerArquivo.dvConta.value);
    headerArquivo.dataGeracao = asStringDate(Cnab240.headerArquivo.dataGeracaoArquivo.value, Cnab104Const.cnabDateOutput);
    headerArquivo.nomeEmpresa = String(Cnab240.headerArquivo.nomeEmpresa.value);
    headerArquivo.nsa = Number(Cnab240.headerArquivo.nsa.value);
    headerArquivo.parametroTransmissao = String(Cnab240.headerArquivo.parametroTransmissao.value);
    headerArquivo.tipoArquivo = HeaderArquivoTipoArquivo.Retorno;
    headerArquivo.tipoInscricao = String(Cnab240.headerArquivo.tipoInscricao.value);
    headerArquivo.numeroInscricao = String(Cnab240.headerArquivo.numeroInscricao.value);

    const headerArquivoRemessa = await this.headerArquivoRepository.getOne({
      nsa: Number(Cnab240.headerArquivo.nsa.value),
      tipoArquivo: HeaderArquivoTipoArquivo.Remessa
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

      // 
      l.registros.forEach(async registro => {
        const r = (registro as ICnab240_104RegistroAB);
        const cliente =
          await this.clienteFavorecidoService.getOne(
            {
              contaCorrente: r.detalheA.contaCorrenteDestino.value,
              dvContaCorrente: r.detalheA.dvContaDestino.value
            });

        const detalheA = new DetalheADTO();
        detalheA.headerLote = { id: headerLoteSave.id };
        detalheA.loteServico = Number(r.detalheA?.loteServico.value);
        detalheA.clienteFavorecido = { id: cliente.id };
        detalheA.finalidadeDOC = String(r.detalheA?.finalidadeDOC.value);
        detalheA.numeroDocumentoEmpresa = Number(r.detalheA?.numeroDocumentoEmpresa.value);
        detalheA.dataVencimento = asStringDate(r.detalheA.dataVencimento.value, Cnab104Const.cnabDateOutput);
        detalheA.tipoMoeda = String(r.detalheA?.tipoMoeda.value);
        detalheA.quantidadeMoeda = Number(r.detalheA?.quantidadeMoeda.value);
        detalheA.valorLancamento = Number(r.detalheA?.valorLancamento.value);
        detalheA.numeroDocumentoBanco = Number(r.detalheA?.numeroDocumentoBanco.value);
        detalheA.quantidadeParcelas = Number(r.detalheA?.quantidadeParcelas.value);
        detalheA.indicadorBloqueio = r.detalheA?.indicadorBloqueio.value;
        detalheA.indicadorFormaParcelamento = String(r.detalheA?.indicadorFormaParcelamento.value);
        detalheA.periodoVencimento = asStringDate(r.detalheA?.dataVencimento.value, Cnab104Const.cnabDateOutput);
        detalheA.numeroParcela = Number(r.detalheA?.numeroParcela.value);
        detalheA.dataEfetivacao = asStringDate(r.detalheA.dataEfetivacao.value, Cnab104Const.cnabDateOutput);
        detalheA.valorRealEfetivado = Number(r.detalheA?.valorRealEfetivado.value);
        detalheA.nsr = Number(r.detalheA.nsr.value);
        const detalheASave = await this.detalheAService.save(detalheA);

        const detalheB = new DetalheBDTO();
        detalheB.detalheA = { id: detalheASave.id };
        detalheB.nsr = Number(r.detalheB.nsr.value);
        detalheB.dataVencimento = asStringDate(r.detalheB.dataVencimento.value, Cnab104Const.cnabDateOutput);
        await this.detalheBService.save(detalheB);
      });
    })
  }


  public async compareRemessaToRetorno(): Promise<void> {
    const arquivosRemessa = await this.headerArquivoRepository.findAll({
      tipoArquivo: HeaderArquivoTipoArquivo.Remessa
    });

    arquivosRemessa.forEach(async headerArquivo => {
      const arquivoPublicacao = new ArquivoPublicacaoDTO();
      arquivoPublicacao.idHeaderArquivo = headerArquivo.id
      arquivoPublicacao.idTransacao = headerArquivo.transacao.id;
      arquivoPublicacao.dataGeracaoRemessa = asDate(headerArquivo.dataGeracao);
      arquivoPublicacao.horaGeracaoRemessa = asDate(headerArquivo.dataGeracao);
      const arquivosRetorno =
        await this.headerArquivoRepository.findAll({
          tipoArquivo: HeaderArquivoTipoArquivo.Retorno,
          nsa: headerArquivo.nsa
        });
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
              arquivoPublicacao.loteServico = asNumber(detalheA.loteServico);
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

  /**
   * numeroDocumento:
   * 
   * - Começa com 000001
   * - Soma 1 para cada registro no arquivo
   * - Reinicia para 1 para cada data de pagamento
   * 
   * Usado nos Dertalhes: A, J, O, N
   * 
   * @example
   * 01/01/2024
   * - Cnab1
   *    - DetalheA = 1
   *    - DetalheA = 2
   * - Cnab2
   *    - DetalheA = 3
   *    - DetalheA = 4
   * 
   * 02/01/2024
   * - Cnab1
   *    - DetalheA = 1
   *    - DetalheA = 2
   * - Cnab2
   *    - DetalheA = 3
   *    - DetalheA = 4
   * 
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.detalheAService.getNextNumeroDocumento(date);
  }

  public async getNextNSA() {
    return await this.headerArquivoRepository.getNextNSA();
  }
}

