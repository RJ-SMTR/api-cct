import { ArquivoPublicacaoRepository } from './../repository/arquivo-publicacao.repository';
import { ClienteFavorecidoService } from './cliente-favorecido.service';
import { ArquivoPublicacaoDTO } from './../dto/arquivo-publicacao.dto';
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
    return await this.headerArquivoRepository.findAll({});
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

  public async saveArquivoRetorno(_cnab240:ICnab240_104File):Promise<void>{
    const headerArquivo = new HeaderArquivo();
    headerArquivo.cod_banco = String(_cnab240.headerArquivo.codigoBanco.value);
    headerArquivo.agencia  =String( _cnab240.headerArquivo.agenciaContaCorrente.value );
    headerArquivo.num_conta =String( _cnab240.headerArquivo.numeroConta.value );
    headerArquivo.dv_conta =String( _cnab240.headerArquivo.dvConta.value );
    headerArquivo.dt_geracao = new Date( _cnab240.headerArquivo.dataGeracaoArquivo.value);
    headerArquivo.nome_empresa =String( _cnab240.headerArquivo.nomeEmpresa.value);
    headerArquivo.nsa =String( _cnab240.headerArquivo.nsa.value);  
    headerArquivo.param_transmissao =String( _cnab240.headerArquivo.parametroTransmissao.value);
    headerArquivo.tipo_arquivo = "retorno";
    headerArquivo.tipo_inscricao =String( _cnab240.headerArquivo.tipoInscricao.value);
    headerArquivo.num_inscricao =String( _cnab240.headerArquivo.numeroInscricao.value);
    
    const headerArquivoRemessa = await this.headerArquivoRepository.findOne({
      nsa: String(_cnab240.headerArquivo.nsa.value),
      tipo_arquivo: "remessa"
    });

    headerArquivo.id_transacao = headerArquivoRemessa?.id_transacao as number;  
    const headerArquivoSave = await this.headerArquivoRepository.save(headerArquivo);
    _cnab240.lotes.forEach(async l=>{
        const headerLote = new HeaderLoteDTO();
        
        headerLote.id_header_arquivo = headerArquivoSave.id_header_arquivo;
        headerLote.lote_servico = l.headerLote.loteServico.value ;
        headerLote.cod_convenio_banco = l.headerLote.codigoConvenioBanco.value;
        headerLote.num_inscricao = l.headerLote.numeroInscricao.value;
        headerLote.param_transmissao = l.headerLote.param_transmissao.value ;
        headerLote.tipo_compromisso = l.headerLote.tipoCompromisso.value ;
        headerLote.tipo_inscricao = l.headerLote.tipoInscricao.value ;
        
        const pagador = await this.pagadorService.findByConta(l.headerLote.numeroConta.value);
        headerLote.id_pagador = Number(pagador?.id_pagador);

        const headerLoteSave = await this.headerLoteService.save(headerLote);  
        l.registros.forEach(async r=>{
          const detalheA = new DetalheADTO();
          detalheA.id_header_lote = headerLoteSave.id_header_lote;
          detalheA.data_efetivacao = r.detalheA?.dataEfetivacao as unknown as Date;
          detalheA.dt_vencimento = r.detalheA?.dataVencimento as unknown as Date;
          detalheA.indicador_bloqueio = r.detalheA?.indicadorBloqueio.value ;
          detalheA.indicador_forma_parcelamento = r.detalheA?.indicadorFormaParcelamento.value ;
          detalheA.lote_servico = r.detalheA?.loteServico.value ;
          detalheA.nsr = r.detalheA?.nsr.value;
          detalheA.num_doc_lancamento = r.detalheA?.numeroDocumento.value;
          detalheA.num_parcela = r.detalheA?.numeroParcela.value;
          detalheA.periodo_vencimento = new Date(r.detalheA?.dataVencimento.value);
          detalheA.qtde_moeda = r.detalheA?.quantidadeMoeda.value;
          detalheA.qtde_parcelas = r.detalheA?.quantidadeMoeda.value;
          detalheA.valor_lancamento = r.detalheA?.valor_lancamento.value;
          detalheA.tipo_finalidade_conta = r.detalheA?.tipoContaFinalidade.value ;
          detalheA.tipo_moeda = String(r.detalheA?.tipoMoeda.value) ;
          detalheA.valor_real_efetivado = r.detalheA?.valorRealEfetivado.value;

          const cliente =
          await this.clienteFavorecidoService.findOne(
            {conta_corrente: r.detalheA?.contaCorrenteDestino.value ,
             dv_conta_corrente: r.detalheA?.dvContaDestino.value });

            detalheA.id_cliente_favorecido = cliente?.id_cliente_favorecido;

          const detalheASave = await this.detalheAService.save(detalheA);

          const detalheB = new DetalheBDTO();
          detalheB.id_detalhe_a = detalheASave.id_detalhe_a;
          detalheB.nsr = r.detalheB?.nsr.value;
          detalheB.data_vencimento = r.detalheB?.dataVencimento as unknown as Date;
          await this.detalheBService.save(detalheB);
        });  
    })
  }


  public async compareRemessaToRetorno():Promise<void>{
    const arquivosRemessa = await this.headerArquivoRepository.findAll({tipo_arquivo: "remessa"});
   
    arquivosRemessa.forEach(async headerArquivo => {
      const arquivoPublicacao = new ArquivoPublicacaoDTO();
      arquivoPublicacao.id_header_arquivo = headerArquivo.id_header_arquivo
      arquivoPublicacao.id_transacao = headerArquivo.id_transacao;      
      arquivoPublicacao.dt_geracao_remessa = headerArquivo.dt_geracao;
      arquivoPublicacao.hr_geracao_remessa = headerArquivo.hr_geracao;
      const arquivosRetorno = 
         await this.headerArquivoRepository.findAll({tipo_arquivo:"retorno", nsa: headerArquivo.nsa}) ;
      if (arquivosRetorno !=null){
        //Header Arquivo Retorno
        arquivosRetorno.forEach(async arquivoRetorno=> {        
            const headersLoteRetorno = 
                await this.headerLoteService.findMany({ id_header_arquivo: arquivoRetorno.id_header_arquivo });
          arquivoPublicacao.dt_geracao_retorno = arquivoRetorno.dt_geracao;
          arquivoPublicacao.hr_geracao_retorno = arquivoRetorno.hr_geracao;
          //Header lote Retorno
          headersLoteRetorno.forEach(async headerLoteRetorno => {
            //DetalheA Retorno
            const detalhesA = await this.detalheAService.findMany({ id_header_lote: headerLoteRetorno.id_header_lote});
            detalhesA.forEach( async detalheA => {
              arquivoPublicacao.lote_servico = detalheA.lote_servico;
              arquivoPublicacao.dt_vencimento = detalheA.dt_vencimento;            
              arquivoPublicacao.valor_lancamento = detalheA.valor_lancamento;
              arquivoPublicacao.data_efetivacao = detalheA.data_efetivacao; 
              arquivoPublicacao.valor_real_efetivado = detalheA.valor_real_efetivado;            
                const clienteFavorecido = 
                await this.clienteFavorecidoService.getOneByIdClienteFavorecido(detalheA.id_cliente_favorecido);   
                arquivoPublicacao.nome_cliente = clienteFavorecido.nome ;
                arquivoPublicacao.cpf_cnpj_cliente = String(clienteFavorecido.cpf_cnpj);
                arquivoPublicacao.cod_banco_cliente = String(clienteFavorecido.cod_banco) ;
                arquivoPublicacao.agencia_cliente = String(clienteFavorecido.agencia);
                arquivoPublicacao.dv_agencia_cliente = String(clienteFavorecido.dv_agencia);
                arquivoPublicacao.conta_corrente_cliente = String(clienteFavorecido.conta_corrente);
                arquivoPublicacao.dv_conta_corrente_cliente = String(clienteFavorecido.dv_conta_corrente);
                arquivoPublicacao.ocorrencias = detalheA.ocorrencias; 
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
    const retorno = await this.headerArquivoRepository.findOne(
      { tipoArquivo: HeaderArquivoTipoArquivo.Retorno },
      { createdAt: 'DESC' }
    );
    return retorno?.createdAt || new Date(0);
  }
}

