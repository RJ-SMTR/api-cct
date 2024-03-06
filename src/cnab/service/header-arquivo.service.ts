import { ArquivoPublicacaoRepository } from './../repository/arquivo-publicacao.repository';
import { ClienteFavorecidoService } from './cliente-favorecido.service';
import { ArquivoPublicacaoDTO } from './../dto/arquivo-publicacao.dto';
import { Injectable, Logger } from '@nestjs/common';
import { BanksService } from 'src/banks/banks.service';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { DetalheADTO } from '../dto/detalhe-a.dto';
import { DetalheBDTO } from '../dto/detalhe-b.dto';
import { HeaderArquivoDTO } from '../dto/header-arquivo.dto';
import { ItemTransacao } from '../entity/item-transacao.entity';
import { Transacao } from '../entity/transacao.entity';
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
import { ItemTransacaoService } from './item-transacao.service';
import { Cnab104Service } from './cnab-104.service';
import { DetalheAService } from './detalhe-a.service';
import { DetalheBService } from './detalhe-b.service';
import { HeaderLoteService } from './header-lote.service';
import { PagadorService } from './pagador.service';
import { TransacaoService } from './transacao.service';
import { SftpService } from '../sftp/sftp.service';

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

  public async saveRemessa(): Promise<void> {
    const listAllTransacao = await this.transacaoService.getAll();
    for (const transacao of listAllTransacao) {
      if (!this.headerArquivoExists(transacao.id_transacao)) {
        const { cnabString, cnabTables } = await this.generateCnab(transacao);
        await this.performSaveRemessa(cnabTables);
        await this.sendCnabSFTP(cnabString);
      }
    }
  }

  private async sendCnabSFTP(cnabString: string) {
    await this.sftpService.submitFromString(cnabString, 'arquivo/123-wip-rem.txt');
  }

  private async performSaveRemessa(cnabTables: ICnabTables) {
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
    const headerArquivoDTO = await this.transacaoToHeaderArquivoDTO(
      transacao,
      'remessa',
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
      transacao.id_transacao,
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
      code: Number(headerArquivoDTO.cod_banco),
    });

    const headerArquivo104: ICnab240_104HeaderArquivo = structuredClone(
      headerArquivoTemplate,
    );
    headerArquivo104.codigoBanco.value = headerArquivoDTO.cod_banco;
    headerArquivo104.numeroInscricao.value = headerArquivoDTO.num_inscricao;
    headerArquivo104.codigoConvenioBanco.value = headerArquivoDTO.cod_convenio;
    headerArquivo104.parametroTransmissao.value =
      headerArquivoDTO.param_transmissao;
    headerArquivo104.ambienteCliente.value =
      this.cnab104Service.getCnab104ClienteCaixa();
    headerArquivo104.agenciaContaCorrente.value = headerArquivoDTO.agencia;
    headerArquivo104.numeroConta.value = headerArquivoDTO.num_conta;
    headerArquivo104.dvAgencia.value = headerArquivoDTO.dv_agencia;
    headerArquivo104.dvConta.value = headerArquivoDTO.dv_conta;
    headerArquivo104.nomeEmpresa.value = headerArquivoDTO.nome_empresa;
    headerArquivo104.nomeBanco.value = bank.name;
    headerArquivo104.tipoArquivo.value = headerArquivoDTO.tipo_arquivo;
    headerArquivo104.dataGeracaoArquivo.value = headerArquivoDTO.dt_geracao;
    headerArquivo104.horaGeracaoArquivo.value = headerArquivoDTO.hr_geracao;

    return headerArquivo104;
  }

  public getHeaderLote104(
    headerLoteDTO: HeaderLoteDTO,
  ): ICnab240_104HeaderLote {
    const headerLote104: ICnab240_104HeaderLote =
      structuredClone(headerLoteTemplate);
    headerLote104.codigoConvenioBanco.value = headerLoteDTO.cod_convenio_banco;
    headerLote104.numeroInscricao.value = headerLoteDTO.num_inscricao;
    headerLote104.agenciaContaCorrente.value = headerLoteDTO.num_inscricao;
    headerLote104.parametroTransmissao.value = headerLoteDTO.param_transmissao;
    headerLote104.tipoInscricao.value = headerLoteDTO.tipo_inscricao;

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
    detalheA.dataEfetivacao.value = itemTransacao.dt_transacao;
    detalheA.dataVencimento.value = itemTransacao.dt_processamento;
    detalheA.loteServico.value = headerLoteDTO.lote_servico;
    detalheA.periodoDiaVencimento.value = itemTransacao.dt_processamento;
    detalheA.valorLancamento.value = itemTransacao.valor_item_transacao;
    detalheA.valorRealEfetivado.value = itemTransacao.valor_item_transacao;

    const detalheB: ICnab240_104DetalheB = structuredClone(detalheBTemplate);
    detalheB.dataVencimento.value = itemTransacao.dt_processamento;

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

  private async transacaoToHeaderArquivoDTO(
    transacao: Transacao,
    tipo_arquivo: string,
  ): Promise<HeaderArquivoDTO> {
    const dto = new HeaderArquivoDTO();
    const pagador = await this.pagadorService.getOneByIdPagador(transacao.id_pagador);
    dto.agencia = pagador.agencia;
    dto.cod_banco = String(headerArquivoTemplate.codigoBanco.value);
    dto.cod_convenio = String(headerArquivoTemplate.codigoConvenioBanco.value);
    dto.dt_geracao = transacao.dt_ordem;
    dto.dv_agencia = pagador.dv_agencia;
    dto.dv_conta = pagador.dv_conta;
    dto.hr_geracao = transacao.dt_ordem;
    dto.id_transacao = transacao.id_transacao;
    dto.nome_empresa = pagador.nome_empresa;
    dto.num_conta = pagador.conta;
    dto.num_inscricao = pagador.cpf_cnpj;
    dto.param_transmissao = String(
      headerArquivoTemplate.parametroTransmissao.value,
    );
    dto.tipo_arquivo = tipo_arquivo;
    dto.tipo_inscricao = String(headerArquivoTemplate.tipoInscricao.value);
    return dto;
  }

  private updateHeaderLoteDTOFrom104(
    headerLoteDTO: HeaderLoteDTO,
    headerLote104: ICnab240_104HeaderLote,
  ) {
    headerLoteDTO.lote_servico = String(headerLote104.loteServico.value);
  }

  private transacaoToHeaderLoteDTO(
    transacao: Transacao,
    headerArquivoDTO: HeaderArquivoDTO,
  ): HeaderLoteDTO {
    const dto = new HeaderLoteDTO();
    dto.cod_convenio_banco = headerArquivoDTO.cod_convenio;
    dto.id_header_arquivo = headerArquivoDTO.id_header_arquivo;
    dto.id_pagador = transacao.id_pagador;
    //autoincremento no banco => dto.lote_servico = ;
    dto.num_inscricao = headerArquivoDTO.num_inscricao;
    dto.param_transmissao = headerArquivoDTO.param_transmissao;
    dto.tipo_compromisso = String(headerLoteTemplate.tipoCompromisso.value);
    dto.tipo_inscricao = headerArquivoDTO.tipo_inscricao;
    return dto;
  }

  private async saveDetalhes(
    itemTransacao: ItemTransacao,
    headerLoteDTO: HeaderLoteDTO,
    registroAB: ICnab240_104RegistroAB,
  ): Promise<void> {
    const dataTransacao = new Date(itemTransacao.getDtTransacao());

    const detalheA = new DetalheADTO();
    detalheA.data_efetivacao = dataTransacao;
    detalheA.dt_vencimento = itemTransacao.dt_processamento;
    detalheA.id_header_lote = headerLoteDTO.id_header_lote;
    detalheA.indicador_bloqueio = String(
      registroAB.detalheA.indicadorBloqueio.value,
    );
    detalheA.id_cliente_favorecido = itemTransacao.id_cliente_favorecido;
    detalheA.indicador_forma_parcelamento = String(
      detalheATemplate.indicadorFormaParcelamento.value,
    );
    detalheA.lote_servico = headerLoteDTO.lote_servico;
    detalheA.num_doc_lancamento =
      await this.detalheAService.getNextNumeroDocumento(dataTransacao);
    detalheA.periodo_vencimento = itemTransacao.dt_processamento;
    detalheA.num_parcela = Number(registroAB.detalheA.numeroParcela.value);
    detalheA.qtde_parcelas = Number(
      registroAB.detalheA.quantidadeParcelas.value,
    );
    detalheA.tipo_finalidade_conta = String(
      registroAB.detalheA.finalidadeDOC.value,
    );
    detalheA.tipo_moeda = String(registroAB.detalheA.tipoMoeda.value);
    detalheA.qtde_moeda = Number(registroAB.detalheA.quantidadeMoeda.value);
    detalheA.valor_lancamento = itemTransacao.valor_item_transacao;
    detalheA.valor_real_efetivado = itemTransacao.valor_item_transacao;
    const saveDetalheA = this.detalheAService.save(detalheA);

    const detalheB = new DetalheBDTO();
    detalheB.data_vencimento = itemTransacao.dt_processamento;
    detalheB.nsr = Number(registroAB.detalheB.nsr.value);
    detalheB.id_detalhe_a = (await saveDetalheA).id_detalhe_a;
    await this.detalheBService.save(detalheB);
  }

  private async headerArquivoExists(id_transacao: number): Promise<boolean> {
    const ret = await this.headerArquivoRepository.findOne({
      id_transacao: id_transacao,
    });
    if (ret == null) {
      return false;
    }
    return true;
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
              arquivoPublicacao.dt_vencimento = detalheA.dt_vencimento;            
              arquivoPublicacao.valor_lancamento = detalheA.valor_lancamento;
              arquivoPublicacao.data_efetivacao = detalheA.data_efetivacao;
              arquivoPublicacao.valor_real_efetivado = detalheA.valor_real_efetivado;
              arquivoPublicacao.ocorrencias = detalheA.ocorrencias;
                const clienteFavorecido = 
                await this.clienteFavorecidoService.getOneByIdClienteFavorecido(detalheA.id_cliente_favorecido);   
                arquivoPublicacao.nome_cliente = clienteFavorecido.nome ;
                arquivoPublicacao.cpf_cnpj_cliente = clienteFavorecido.cpf_cnpj;
                arquivoPublicacao.cod_banco_cliente = clienteFavorecido.cod_banco ;
                arquivoPublicacao.agencia_cliente = clienteFavorecido.agencia;
                arquivoPublicacao.dv_agencia_cliente = clienteFavorecido.dv_agencia;
                arquivoPublicacao.conta_corrente_cliente = clienteFavorecido.conta_corrente;
                arquivoPublicacao.dv_conta_corrente_cliente = clienteFavorecido.dv_conta_corrente;
                arquivoPublicacao.ocorrencias = detalheA.ocorrencias;
                void this.arquivoPublicacaoRepository.save(arquivoPublicacao);
            });
          });
        });
      }
    });    
  }
}