import { Injectable, Logger } from '@nestjs/common';
import { format } from 'date-fns';
import { BanksService } from 'src/banks/banks.service';
import { SftpService } from 'src/sftp/sftp.service';
import { logLog, logWarn } from 'src/utils/log-utils';
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
    return await this.headerArquivoRepository.findMany({});
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
    headerLoteDTO.loteServico = Number(headerLote104.loteServico.value);
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

    const detalheA = new DetalheADTO({
      headerLote: { id: headerLoteDTO.id },
      clienteFavorecido: { id: itemTransacao.clienteFavorecido.id },
      loteServico: Number(r.detalheA.loteServico.value),
      finalidadeDOC: String(r.detalheA.finalidadeDOC.value),
      numeroDocumentoEmpresa: Number(r.detalheA.numeroDocumentoEmpresa.value),
      dataVencimento: asDate(new Date(r.detalheA.dataVencimento.value)),
      tipoMoeda: String(r.detalheA.tipoMoeda.value),
      quantidadeMoeda: Number(r.detalheA.quantidadeMoeda.value),
      valorLancamento: getNumberFromCnabField(r.detalheA.valorLancamento),
      numeroDocumentoBanco: Number(r.detalheA.numeroDocumentoBanco.value),
      quantidadeParcelas: Number(r.detalheA.quantidadeParcelas.value),
      indicadorBloqueio: String(r.detalheA.indicadorBloqueio.value),
      indicadorFormaParcelamento: String(
        r.detalheA.indicadorFormaParcelamento.value,
      ),
      periodoVencimento: asDate(itemTransacao.dataProcessamento),
      numeroParcela: Number(r.detalheA.numeroParcela.value),
      dataEfetivacao: null,
      valorRealEfetivado: null,
      nsr: Number(r.detalheA.nsr.value),
      ocorrencias: null,
    });
    const saveDetalheA = await this.detalheAService.save(detalheA);

    const detalheB = new DetalheBDTO({
      dataVencimento: asDate(itemTransacao.dataProcessamento),
      nsr: Number(r.detalheB.nsr.value),
      detalheA: { id: saveDetalheA.id },
    });
    await this.detalheBService.save(detalheB);
  }

  /**
   * This task will:
   * 1. Get existing corresponding Remessa to use as base
   * 2. For each Registro in Retorno save it in each CNAB Table
   * 
   * @throws `HttpException` if any sub task fails
   * 
   * @returns `true` if new Retorno has been created.
   * 
   * `false` if retorno already exists.
   */
  public async saveArquivoRetorno(cnab240: ICnab240_104File): Promise<boolean> {
    const METHOD = 'saveArquivoRetorno()';
    // Save HeaderArquivo
    const headerArquivoRemessa = await this.headerArquivoRepository.getOne({
      nsa: Number(cnab240.headerArquivo.nsa.value),
      tipoArquivo: HeaderArquivoTipoArquivo.Remessa
    });
    const headerArquivoDTO = new HeaderArquivoDTO({
      tipoArquivo: HeaderArquivoTipoArquivo.Retorno,
      codigoBanco: String(cnab240.headerArquivo.codigoBanco.value),
      tipoInscricao: String(cnab240.headerArquivo.tipoInscricao.value),
      numeroInscricao: String(cnab240.headerArquivo.numeroInscricao.value),
      codigoConvenio: String(cnab240.headerArquivo.codigoConvenioBanco.value),
      parametroTransmissao: String(cnab240.headerArquivo.parametroTransmissao.value),
      agencia: String(cnab240.headerArquivo.agenciaContaCorrente.value),
      dvAgencia: String(cnab240.headerArquivo.dvAgencia.value),
      numeroConta: String(cnab240.headerArquivo.numeroConta.value),
      dvConta: String(cnab240.headerArquivo.dvConta.value),
      nomeEmpresa: String(cnab240.headerArquivo.nomeEmpresa.value),
      dataGeracao: asStringDate(cnab240.headerArquivo.dataGeracaoArquivo.value, Cnab104Const.cnabDateOutput),
      horaGeracao: asStringDate(cnab240.headerArquivo.horaGeracaoArquivo.value, Cnab104Const.cnabTimeOutput),
      transacao: ({ id: headerArquivoRemessa.transacao.id } as Transacao),
      nsa: Number(cnab240.headerArquivo.nsa.value),
    });

    const headerArquivoSave = await this.headerArquivoRepository.saveIfNotExists(headerArquivoDTO);
    if (!headerArquivoSave.isNewItem) {
      logWarn(this.logger,
        `Retorno HeaderArquivo ${new HeaderArquivo(headerArquivoDTO).getComposedPKLog()} já existe no banco, ignorando...`,
        METHOD);
      return false;
    }

    for (const l of cnab240.lotes) {
      // Save HeaderLote
      const pagador = await this.pagadorService.getByConta(l.headerLote.numeroConta.value);
      const headerLote = new HeaderLoteDTO({
        headerArquivo: { id: headerArquivoSave.item.id },
        loteServico: Number(l.headerLote.loteServico.value),
        codigoConvenioBanco: asString(l.headerLote.codigoConvenioBanco.value),
        numeroInscricao: asString(l.headerLote.numeroInscricao.value),
        parametroTransmissao: asString(l.headerLote.parametroTransmissao.value),
        tipoCompromisso: l.headerLote.tipoCompromisso.value,
        tipoInscricao: l.headerLote.tipoInscricao.value,
        pagador: { id: pagador.id },
      });
      const headerLoteSave = await this.headerLoteService.save(headerLote);

      for (const registro of l.registros) {
        // Save DetalheA, DetalheB
        const r = (registro as ICnab240_104RegistroAB);
        const favorecido =
          await this.clienteFavorecidoService.getOne(
            {
              contaCorrente: r.detalheA.contaCorrenteDestino.value,
              dvContaCorrente: r.detalheA.dvContaDestino.value
            });

        const detalheA = new DetalheADTO({
          headerLote: { id: headerLoteSave.id },
          loteServico: Number(r.detalheA?.loteServico.value),
          clienteFavorecido: { id: favorecido.id },
          finalidadeDOC: String(r.detalheA.finalidadeDOC.value),
          numeroDocumentoEmpresa: Number(r.detalheA.numeroDocumentoEmpresa.value),
          dataVencimento: asStringDate(r.detalheA.dataVencimento.value, Cnab104Const.cnabDateOutput),
          tipoMoeda: String(r.detalheA.tipoMoeda.value),
          quantidadeMoeda: Number(r.detalheA.quantidadeMoeda.value),
          valorLancamento: Number(r.detalheA.valorLancamento.value),
          numeroDocumentoBanco: Number(r.detalheA.numeroDocumentoBanco.value),
          quantidadeParcelas: Number(r.detalheA.quantidadeParcelas.value),
          indicadorBloqueio: r.detalheA?.indicadorBloqueio.value,
          indicadorFormaParcelamento: String(r.detalheA.indicadorFormaParcelamento.value),
          periodoVencimento: asStringDate(r.detalheA.dataVencimento.value, Cnab104Const.cnabDateOutput),
          numeroParcela: Number(r.detalheA?.numeroParcela.value),
          dataEfetivacao: asStringDate(r.detalheA.dataEfetivacao.value, Cnab104Const.cnabDateOutput),
          valorRealEfetivado: Number(r.detalheA.valorRealEfetivado.value),
          nsr: Number(r.detalheA.nsr.value),
          ocorrencias: asString(r.detalheA.ocorrencias.value).trim(),
        });
        const detalheASave = await this.detalheAService.save(detalheA);

        const detalheB = new DetalheBDTO({
          detalheA: { id: detalheASave.id },
          nsr: Number(r.detalheB.nsr.value),
          dataVencimento: asStringDate(r.detalheB.dataVencimento.value, Cnab104Const.cnabDateOutput),
        });
        await this.detalheBService.save(detalheB);
      }
    }
    return true;
  }


  /**
   * saveArquivoPublicacao()
   * 
   * From Remessa and Retorno, save new ArquivoPublicacao
   * 
   * This task will:
   * 1. Find all new Remessa
   * 2. For each remessa get corresponding Retorno, HeaderLote and Detalhes
   * 3. For each DetalheA, save new ArquivoPublicacao if not exists
   */
  public async compareRemessaToRetorno(): Promise<void> {
    const METHOD = 'compareRemessaToRetorno()';
    const remessas = await this.headerArquivoRepository.findAllNewRemessa();
    if (!remessas.length) {
      logLog(this.logger, 'Não há novas remessas para atualizar ArquivoPublicacao, ignorando sub-rotina...', METHOD);
    }

    // Header Arquivo Remessa
    for (const remessa of remessas) {
      const retornos =
        await this.headerArquivoRepository.findMany({
          tipoArquivo: HeaderArquivoTipoArquivo.Retorno,
          nsa: remessa.nsa,
          transacao: { id: remessa.transacao.id }
        });

      // Header Arquivo Retorno
      for (const retorno of retornos) {
        const headersLoteRetorno =
          await this.headerLoteService.findMany({ headerArquivo: { id: retorno.id } });

        // Header lote Retorno
        for (const headerLoteRetorno of headersLoteRetorno) {
          const pagador = headerLoteRetorno.pagador;
          const detalhesARet = await this.detalheAService.findMany({ headerLote: { id: headerLoteRetorno.id } });

          // DetalheA Retorno
          for (const detalheA of detalhesARet) {
            const favorecido = detalheA.clienteFavorecido;
            const arquivoPublicacao = new ArquivoPublicacaoDTO({
              headerArquivo: { id: remessa.id },
              idTransacao: remessa.transacao.id,
              dataGeracaoRemessa: asDate(remessa.dataGeracao),
              horaGeracaoRemessa: asDate(remessa.dataGeracao),
              dataGeracaoRetorno: asDate(retorno.dataGeracao),
              horaGeracaoRetorno: asDate(retorno.horaGeracao),
              loteServico: asNumber(detalheA.loteServico),
              dataVencimento: asDate(detalheA.dataVencimento),
              valorLancamento: asNumber(detalheA.valorLancamento),
              dataEfetivacao: asDate(detalheA.dataEfetivacao),
              valorRealEfetivado: asNumber(detalheA.valorRealEfetivado),
              nomeCliente: favorecido.nome,
              cpfCnpjCliente: asString(favorecido.cpfCnpj),
              codigoBancoCliente: asString(favorecido.codigoBanco),
              agenciaCliente: asString(favorecido.agencia),
              dvAgenciaCliente: asString(favorecido.dvAgencia),
              contaCorrenteCliente: asString(favorecido.contaCorrente),
              dvContaCorrenteCliente: asString(favorecido.dvContaCorrente),
              ocorrencias: asString(detalheA.ocorrencias, 'detalheA.ocorrencias'),
              agenciaPagador: asString(pagador.agencia),
              contaPagador: asString(pagador.conta),
              dvAgenciaPagador: asString(pagador.dvAgencia),
              dvContaPagador: asString(pagador.dvConta),
              idHeaderLote: headerLoteRetorno.id,
              nomePagador: pagador.nomeEmpresa,
              idDetalheARetorno: detalheA.id,
            });
            await this.arquivoPublicacaoRepository.saveIfNotExists(arquivoPublicacao);
          }
        }
      }
    }
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

