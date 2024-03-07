import { Injectable, Logger } from '@nestjs/common';
import { BanksService } from 'src/banks/banks.service';
import { SftpService } from 'src/sftp/sftp.service';
import { asDate, asNumber, asString } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
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
import { HeaderLoteDTO } from './../dto/header-lote.dto';
import { HeaderArquivo } from './../entity/header-arquivo.entity';
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
    private transacaoService: TransacaoService,
    private headerLoteService: HeaderLoteService,
    private itemTransacaoService: ItemTransacaoService,
    private pagadorService: PagadorService,
    private detalheAService: DetalheAService,
    private detalheBService: DetalheBService,
    private cnab104Service: Cnab104Service,
    private banksService: BanksService,
    private sftpService: SftpService,
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
    headerArquivo104.dataGeracaoArquivo.value = headerArquivoDTO.dataHoraGeracao;
    headerArquivo104.horaGeracaoArquivo.value = headerArquivoDTO.dataHoraGeracao;

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
    return await this.headerArquivoRepository.findOne(fields);
  }

  public async findAll(): Promise<HeaderArquivo[]> {
    return await this.headerArquivoRepository.findAll();
  }

  private async getHeaderArquivoDTOFromTransacao(
    transacao: Transacao,
    tipo_arquivo: HeaderArquivoTipoArquivo,
  ): Promise<HeaderArquivoDTO> {
    const dto = new HeaderArquivoDTO();
    const pagador = await this.pagadorService.getOneByIdPagador(transacao.pagador.id);
    dto.agencia = asString(pagador.agencia);
    dto.codigoBanco = String(headerArquivoTemplate.codigoBanco.value);
    dto.codigoConvenio = String(headerArquivoTemplate.codigoConvenioBanco.value);
    dto.dataHoraGeracao = asDate(transacao.dataOrdem);
    dto.dvAgencia = asString(pagador.dvAgencia);
    dto.dvConta = asString(pagador.dvConta);
    dto.transacao = transacao;
    dto.nomeEmpresa = pagador.nomeEmpresa;
    dto.numeroConta = asString(pagador.conta);
    dto.numeroInscricao = asString(pagador.cpfCnpj);
    dto.parametroTransmissao = String(
      headerArquivoTemplate.parametroTransmissao.value,
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
    const ret = await this.headerArquivoRepository.findOne({
      transacao: { id: id_transacao },
    });
    if (ret == null) {
      return false;
    }
    return true;
  }

  /**
   * Get the most recent CNAB Retorno Date saved in database.
   */
  public async getMostRecentRetornoDate(): Promise<Date> {
    const retorno = await this.headerArquivoRepository.findOne(
      { tipoArquivo: HeaderArquivoTipoArquivo.Retorno },
      { createdAt: 'DESC' }
    );
    return retorno?.createdAt || new Date(0);
  }
}
