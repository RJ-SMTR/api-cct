import { HeaderArquivoDTO } from './../../dto/pagamento/header-arquivo.dto';
import { Injectable, Logger } from '@nestjs/common';
import { startOfDay } from 'date-fns';
import { DetalheADTO } from 'src/cnab/dto/pagamento/detalhe-a.dto';
import { HeaderLoteDTO } from 'src/cnab/dto/pagamento/header-lote.dto';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { ItemTransacaoAgrupado } from 'src/cnab/entity/pagamento/item-transacao-agrupado.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { TransacaoStatus } from 'src/cnab/entity/pagamento/transacao-status.entity';
import { Cnab104FormaLancamento } from 'src/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { CnabTrailerArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-trailer-arquivo-104.interface';
import { CnabFile104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { getCnabFieldConverted } from 'src/cnab/utils/cnab/cnab-field-utils';
import { SettingsService } from 'src/settings/settings.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { asNumber, asString } from 'src/utils/pipe-utils';
import { DeepPartial } from 'typeorm';
import { DetalheBDTO } from '../../dto/pagamento/detalhe-b.dto';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { HeaderArquivoTipoArquivo } from '../../enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { CnabHeaderArquivo104 } from '../../interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabDetalheA_104 } from '../../interfaces/cnab-240/104/pagamento/cnab-detalhe-a-104.interface';
import { CnabDetalheB_104 } from '../../interfaces/cnab-240/104/pagamento/cnab-detalhe-b-104.interface';
import { CnabHeaderLote104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { CnabRegistros104Pgto } from '../../interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { stringifyCnab104File } from '../../utils/cnab/cnab-104-utils';
import { getTipoInscricao } from '../../utils/cnab/cnab-utils';
import { DetalheAService } from './detalhe-a.service';
import { DetalheBService } from './detalhe-b.service';
import { HeaderArquivoService } from './header-arquivo.service';
import { HeaderLoteService } from './header-lote.service';
import { ItemTransacaoAgrupadoService } from './item-transacao-agrupado.service';
import { ItemTransacaoService } from './item-transacao.service';
import { TransacaoAgrupadoService } from './transacao-agrupado.service';

const sc = structuredClone;
const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class RemessaRetornoService {
  private logger: Logger = new CustomLogger('CnabPagamentoService', {
    timestamp: true,
  });

  constructor(
    private headerArquivoService: HeaderArquivoService,
    private headerLoteService: HeaderLoteService,
    private transacaoAgService: TransacaoAgrupadoService,
    private itemTransacaoService: ItemTransacaoService,
    private itemTransacaoAgService: ItemTransacaoAgrupadoService,
    private detalheAService: DetalheAService,
    private detalheBService: DetalheBService,
    private settingsService: SettingsService,
  ) {}

  public async saveHeaderArquivoDTO(transacaoAg: TransacaoAgrupado): Promise<HeaderArquivoDTO>{
    const headerArquivoDTO = await this.headerArquivoService.getDTO(HeaderArquivoTipoArquivo.Remessa,transacaoAg);
    const headerArquivo = await this.headerArquivoService.save(headerArquivoDTO);
    headerArquivoDTO.id = headerArquivo.id; 
    return headerArquivoDTO;
  }

  /**
   * Cada lote é separado por:
   * - tipoCompromisso
   * - formaLancamento
   *
   * Regras:
   *
   * tipoCompromisso: fixo
   * formaLancamento:
   *  - se banco favorecido = Caixa, CreditoContaCorrente (01)
   *    (se banco do favorecido = banco do pagador - pagador é sempre Caixa)
   *  - senão, TED (41)
   */
  public async getLotes(
    pagador: Pagador,
    headerArquivoDTO: HeaderArquivoDTO,
  ) {
    const transacaoAg = headerArquivoDTO.transacaoAgrupado as TransacaoAgrupado;
    const itemTransacaoAgs =
      await this.itemTransacaoAgService.findManyByIdTransacaoAg(transacaoAg.id);

    // Agrupar por Lotes
    /** Agrupa por: formaLancamento */
    const lotes: HeaderLoteDTO[] = [];
    let nsrTed = 0;
    let nsrCC  = 0;    
    let loteTed;
    let loteCC;
    for (const item of itemTransacaoAgs) {      
      if(item.clienteFavorecido.codigoBanco !== '104'){ //TED   
        nsrTed ++; 
        if(loteTed == undefined){          
          loteTed = this.headerLoteService.getDTO(headerArquivoDTO,pagador,Cnab104FormaLancamento.TED)   
          loteTed = await this.headerLoteService.saveDto(loteTed);       
        }       
        const detalhes104 = await this.saveListDetalhes(loteTed,[item],nsrTed);
        nsrTed ++; 
        loteTed.registros104.push(...detalhes104);
      }else{ //Credito em Conta
        nsrCC++;        
        if(loteCC == undefined){
          loteCC = this.headerLoteService.getDTO(headerArquivoDTO,pagador,Cnab104FormaLancamento.CreditoContaCorrente)  
          loteCC = await this.headerLoteService.saveDto(loteCC);       
        }       
        const detalhes104 = await this.saveListDetalhes(loteCC, [item],nsrCC);
        nsrCC++;
        loteCC.registros104.push(...detalhes104);       
      }       
    }
    if(loteTed != undefined){
      lotes.push(loteTed);
    }
    if(loteCC != undefined){
      lotes.push(loteCC);
    }
    return lotes;
  }

  async convertCnabDetalheAToDTO(
    detalheA: CnabDetalheA_104,
    headerLoteId: number,
    itemTransacaoAg: ItemTransacaoAgrupado,
  ) {
    const existing = await this.detalheAService.findOne({
      where: {
        nsr: Number(detalheA.nsr.value),
        itemTransacaoAgrupado: { id: itemTransacaoAg?.id },
      },
    });
    const favorecidoId = itemTransacaoAg.clienteFavorecido.id as number;
    return new DetalheADTO({
      ...(existing ? { id: existing.id } : {}),
      nsr: Number(detalheA.nsr.value),
      ocorrenciasCnab: detalheA.ocorrencias.value.trim(),
      dataVencimento: startOfDay(
        getCnabFieldConverted(detalheA.dataVencimento),
      ),
      tipoMoeda: detalheA.tipoMoeda.value,
      finalidadeDOC: detalheA.finalidadeDOC.value,
      indicadorBloqueio: detalheA.indicadorBloqueio.value,
      numeroDocumentoBanco: detalheA.numeroDocumentoBanco.value,
      quantidadeParcelas: Number(detalheA.quantidadeParcelas.value),
      numeroDocumentoEmpresa: Number(detalheA.numeroDocumentoEmpresa.value),
      quantidadeMoeda: Number(detalheA.quantidadeMoeda.value),
      valorLancamento: getCnabFieldConverted(detalheA.valorLancamento),
      valorRealEfetivado: getCnabFieldConverted(detalheA.valorRealEfetivado),
      periodoVencimento: startOfDay(detalheA.dataVencimento.convertedValue),
      loteServico: getCnabFieldConverted(detalheA.loteServico),
      indicadorFormaParcelamento: getCnabFieldConverted(
        detalheA.indicadorFormaParcelamento,
      ),
      numeroParcela: getCnabFieldConverted(detalheA.numeroParcela),
      dataEfetivacao: getCnabFieldConverted(detalheA.dataEfetivacao),
      headerLote: { id: headerLoteId },
      itemTransacaoAgrupado: itemTransacaoAg,
      clienteFavorecido: { id: favorecidoId },
    });
  }

  async convertCnabDetalheBToDTO(
    detalheB: CnabDetalheB_104,
    detalheAId: number,
  ) {
    const existing = await this.detalheBService.findOne({
      detalheA: { id: detalheAId },
    });
    return new DetalheBDTO({
      ...(existing ? { id: existing.id } : {}),
      nsr: detalheB.nsr.value,
      detalheA: { id: detalheAId },
      dataVencimento: startOfDay(
        getCnabFieldConverted(detalheB.dataVencimento),
      ),
    });
  }

  /**
   * Montar Cnab104 a partir dos DTOs de tabelas
   */
  public generateFile(headerArquivo: HeaderArquivoDTO, headerLoteDTOs: HeaderLoteDTO[]) {
    const headerArquivo104 = this.getHeaderArquivo104FromDTO(headerArquivo);
    const trailerArquivo104 = sc(PgtoRegistros.trailerArquivo);
    return this.getCnabFilePgto(headerArquivo104,headerLoteDTOs,trailerArquivo104);
  }

  /**
   * Salva no banco e gera Detalhes104 para o lote
   *
   * Para cada ItemTransacaoAg:
   * - Salva no banco
   * - Gera Detalhes104
   *
   * @returns Detalhes104 gerados a partir dos ItemTransacaoAg
   */
  async saveListDetalhes(headerLoteDto: HeaderLoteDTO,itemTransacoes: ItemTransacaoAgrupado[], nsr): Promise<CnabRegistros104Pgto[]> {
    let numeroDocumento = await this.detalheAService.getNextNumeroDocumento(new Date());
    // Para cada itemTransacao, cria detalhe
    const detalhes: CnabRegistros104Pgto[] = [];
    let itemTransacaoAgAux: ItemTransacaoAgrupado | undefined;    
    for (const itemTransacao of itemTransacoes) {      
      itemTransacaoAgAux = itemTransacao as ItemTransacaoAgrupado;    
      const detalhe = await this.saveDetalhes104(numeroDocumento,headerLoteDto, itemTransacaoAgAux,nsr);   
      if (detalhe) {
        detalhes.push(detalhe);
      }
      numeroDocumento++;
    }
    return detalhes;
  }

  
  getCnabFilePgto(
    headerArquivo104: CnabHeaderArquivo104,
    headerLoteDTOs: HeaderLoteDTO[],
    trailerArquivo104: CnabTrailerArquivo104,
  ) {
    const cnab104: CnabFile104Pgto = {
      headerArquivo: headerArquivo104,
      lotes: headerLoteDTOs.map((headerLote) => ({
        headerLote: this.getHeaderLoteFrom104(headerLote),
        registros: headerLote.registros104,
        trailerLote: sc(PgtoRegistros.trailerLote),
      })),
      trailerArquivo: trailerArquivo104,
    };
    cnab104.lotes = cnab104.lotes.filter((l) => l.registros.length > 0);
    if (!cnab104.lotes.length) {
      return null;
    }
    return cnab104;
  }

  private getHeaderArquivo104FromDTO(
    headerArquivoDTO: HeaderArquivoDTO,
  ): CnabHeaderArquivo104 {
    const headerArquivo104: CnabHeaderArquivo104 = sc(
      PgtoRegistros.headerArquivo,
    );
    headerArquivo104.codigoBanco.value = headerArquivoDTO.codigoBanco;
    headerArquivo104.numeroInscricao.value = headerArquivoDTO.numeroInscricao;
    headerArquivo104.codigoConvenioBanco.value =
      headerArquivoDTO.codigoConvenio;
    headerArquivo104.parametroTransmissao.value =
      headerArquivoDTO.parametroTransmissao;
    headerArquivo104.agenciaContaCorrente.value = headerArquivoDTO.agencia;
    headerArquivo104.numeroConta.value = headerArquivoDTO.numeroConta;
    headerArquivo104.dvAgencia.value = headerArquivoDTO.dvAgencia;
    headerArquivo104.dvConta.value = headerArquivoDTO.dvConta;
    headerArquivo104.nomeEmpresa.value = headerArquivoDTO.nomeEmpresa;
    headerArquivo104.tipoArquivo.value = headerArquivoDTO.tipoArquivo;
    headerArquivo104.dataGeracaoArquivo.value = headerArquivoDTO.dataGeracao;
    headerArquivo104.horaGeracaoArquivo.value = headerArquivoDTO.horaGeracao;
    headerArquivo104.nsa.value = headerArquivoDTO.nsa;

    return headerArquivo104;
  }

  public async updateHeaderArquivoDTOFrom104(
    headerArquivoDTO: HeaderArquivoDTO,
    headerArquivo104: CnabHeaderArquivo104,
  ) {
    headerArquivoDTO.nsa = Number(headerArquivo104.nsa.value);
    await this.headerArquivoService.save(headerArquivoDTO);
  }

  public async updateHeaderLoteDTOFrom104(
    headerLoteDTO: HeaderLoteDTO,
    headerLote104: CnabHeaderLote104Pgto,
  ) {
    headerLoteDTO.loteServico = Number(headerLote104.loteServico.value);
    await this.headerLoteService.save(headerLoteDTO);
  }

  // private async updateDetalhesDTOFrom104(detalhes104: CnabRegistros104Pgto) {
  //   headerLoteDTO.loteServico = Number(headerLote104.loteServico.value);
  //   await this.headerLoteService.save(headerLoteDTO);
  // }

  private getHeaderLoteFrom104(
    headerLoteDTO: HeaderLoteDTO,
  ): CnabHeaderLote104Pgto {
    const headerLote104: CnabHeaderLote104Pgto = sc(PgtoRegistros.headerLote);
    const headerArquivo = headerLoteDTO.headerArquivo as HeaderArquivo;
    const pagador = headerLoteDTO.pagador as DeepPartial<Pagador>;
    headerLote104.codigoConvenioBanco.value = headerLoteDTO.codigoConvenioBanco;
    headerLote104.numeroInscricao.value = headerLoteDTO.numeroInscricao;
    headerLote104.parametroTransmissao.value =
      headerLoteDTO.parametroTransmissao;
    headerLote104.tipoInscricao.value = headerLoteDTO.tipoInscricao;
    headerLote104.formaLancamento.value = headerLoteDTO.formaLancamento;
    // Pagador
    headerLote104.agenciaContaCorrente.value = headerArquivo.agencia;
    headerLote104.dvAgencia.value = headerArquivo.dvAgencia;
    headerLote104.numeroConta.value = headerArquivo.numeroConta;
    headerLote104.dvConta.value = headerArquivo.dvConta;
    headerLote104.nomeEmpresa.value = headerArquivo.nomeEmpresa;
    // Pagador addresss
    headerLote104.logradouro.value = pagador.logradouro;
    headerLote104.numeroLocal.value = pagador.numero;
    headerLote104.complemento.value = pagador.complemento;
    headerLote104.cidade.value = pagador.cidade;
    headerLote104.cep.value = pagador.cep;
    headerLote104.complementoCep.value = pagador.complementoCep;
    headerLote104.siglaEstado.value = pagador.uf;

    return headerLote104;
  }

  /**
   * Get Cnab Detalhes A,B.
   *
   * Save Detalhes A, B.
   *
   * If ItemTransacao is not valid yet, status = `fail`.
   *
   * indicadorBloqueio = DataFixa (see `detalheATemplate`)
   *
   * @param numeroDocumento Managed by company. It must be a new number.
   * @returns null if failed ItemTransacao to CNAB */
  public async saveDetalhes104(numeroDocumento: number, headerLote: HeaderLoteDTO, itemTransacaoAg: ItemTransacaoAgrupado, nsr: number)
  : Promise<CnabRegistros104Pgto | null> {
    const METHOD = 'getDetalhes104()';
    const favorecido = itemTransacaoAg.clienteFavorecido as ClienteFavorecido;

    // Failure if no favorecido
    if (!favorecido) {
      await this.itemTransacaoService.save({
        id: itemTransacaoAg.id,
      });

      this.logger.debug(
        `Falha ao usar ItemTransacao: favorecido ausente.`,
        METHOD,
      );
      return null;
    }

    // Save detalheA
    
    const itemTransacaoAgAux = itemTransacaoAg;
    const fridayOrdem = itemTransacaoAgAux.dataOrdem;
    const detalheA: CnabDetalheA_104 = sc(PgtoRegistros.detalheA);
    detalheA.codigoBancoDestino.value = favorecido.codigoBanco;
    detalheA.codigoAgenciaDestino.value = favorecido.agencia;
    detalheA.dvAgenciaDestino.value = favorecido.dvAgencia;
    detalheA.contaCorrenteDestino.value = favorecido.contaCorrente;
    detalheA.dvContaDestino.value = favorecido.dvContaCorrente;
    detalheA.nomeTerceiro.value = favorecido.nome;
    detalheA.numeroDocumentoEmpresa.value = numeroDocumento;
    detalheA.dataVencimento.value = fridayOrdem;    
    detalheA.valorLancamento.value = itemTransacaoAgAux.valor;
    detalheA.nsr.value = nsr;

    const savedDetalheA = await this.saveDetalheA(
      detalheA,
      asNumber(headerLote.id),
      itemTransacaoAg,
    );

    // DetalheB    
    const detalheB: CnabDetalheB_104 = sc(PgtoRegistros.detalheB);
    detalheB.tipoInscricao.value = getTipoInscricao(
      asString(favorecido.cpfCnpj),
    );
    detalheB.numeroInscricao.value = asString(favorecido.cpfCnpj);
    detalheB.dataVencimento.value = detalheA.dataVencimento.value;
    // Favorecido address
    detalheB.logradouro.value = favorecido.logradouro;
    detalheB.numeroLocal.value = favorecido.numero;
    detalheB.complemento.value = favorecido.complemento;
    detalheB.bairro.value = favorecido.bairro;
    detalheB.cidade.value = favorecido.cidade;
    detalheB.cep.value = favorecido.cep;
    detalheB.complementoCep.value = favorecido.complementoCep;
    detalheB.siglaEstado.value = favorecido.uf;
    detalheB.nsr.value = nsr + 1;

    await this.saveDetalheB(detalheB, savedDetalheA.id);

    return {
      detalheA: detalheA,
      detalheB: detalheB,
    };
  }

  async saveDetalheA(
    detalheA104: CnabDetalheA_104,
    savedHeaderLoteId: number,
    itemTransacaoAg: ItemTransacaoAgrupado,
  ) {
    const detalheADTO = await this.convertCnabDetalheAToDTO(
      detalheA104,
      savedHeaderLoteId,
      itemTransacaoAg,
    );
    const saved = await this.detalheAService.save(detalheADTO);
    return await this.detalheAService.getOne({ id: saved.id });
  }

  async saveDetalheB(detalheB104: CnabDetalheB_104, savedDetalheAId: number) {
    const detalheBDTO = await this.convertCnabDetalheBToDTO(
      detalheB104,
      savedDetalheAId,
    );
    await this.detalheBService.save(detalheBDTO);
  }

  // #endregion

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
  public async saveRetorno(cnab: CnabFile104Pgto) {
    const dataEfetivacao = new Date();
    for (const cnabLote of cnab.lotes) {
      for (const registro of cnabLote.registros) {
        // Save Detalhes
        const detalheAUpdated = await this.detalheAService.saveRetornoFrom104(
          cnab.headerArquivo,
          cnabLote.headerLote,
          registro,
          dataEfetivacao,
        );
        if (!detalheAUpdated) {
          continue;
        }
        await this.detalheBService.saveFrom104(registro, detalheAUpdated);
      }
      await this.detalheAService.updateDetalheAStatus(cnabLote);
    }

    // headerArquivoRetUpdated;
  }
}
