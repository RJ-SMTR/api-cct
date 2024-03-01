import { HeaderLoteService } from './header-lote.service';
import { HeaderLoteDTO } from './../dto/header-lote.dto';
import { HeaderArquivo } from './../entity/header-arquivo.entity';
import { Injectable, Logger, Get } from '@nestjs/common';
import { InjectService } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { HeaderArquivoDTO } from '../dto/header-arquivo.dto';
import { HeaderArquivoRepository } from '../repository/header-arquivo.repository';
import { TransacaoService } from './transacao.service';
import { ItemTransacaoService } from './Item-transacao.service';
import { Transacao } from '../entity/transacao.entity';
import { PagadorService } from './pagador.service';
import { ItemTransacao } from '../entity/item-transacao.entity';
import { DetalheAService } from './detalhe-a.service';
import { DetalheBService } from './detalhe-b.service';
import { DetalheADTO } from '../dto/detalhe-a.dto';
import { DetalheBDTO } from '../dto/detalhe-b.dto';

@Injectable()
export class HeaderArquivoService {
    private logger: Logger = new Logger('HeaderArquivoService', { timestamp: true });

    private COD_BANCO ="104";

    private CONVENIO_BANCO = "444773";

    private PARAM_TRANSMISSAO = "01";
    
    private NUM_INSCRICAO = "546037000110";

    private TIPO_INSCRICAO = "2";

    private TIPO_COMPROMISSO = "0001";

    private FINALIDADE= "001";

    private MOEDA = "BRL";

    private INDICADOR_BLOQUEIO="N";

    private FORMA_PARCELAMENTO = "1";

    private NUM_PARCELA=1;

    constructor(
        @InjectService(HeaderArquivo)
        private headerArquivoRepository: HeaderArquivoRepository,
        private transacaoService:TransacaoService,
        private headerLoteService:HeaderLoteService,
        private itemTransacaoService:ItemTransacaoService,
        private pagadorService:PagadorService,
        private detalheAService:DetalheAService,
        private detalheBService:DetalheBService
        ) { }

    
    public async saveRemessa(): Promise<void> {        
        var listAllTransacao = await this.transacaoService.getAll();
        listAllTransacao.forEach(async transacao=>{            
            if(!this.verficaHeaderArquivo(transacao.id_transacao)){
                var headerArquivo = await this.transacaoToHeaderArquivo(transacao, "remessa");
                this.headerArquivoRepository.save(headerArquivo);
                var headerLoteDTO = await this.transacaoToHeaderLote(transacao,headerArquivo)
                this.headerLoteService.save(headerLoteDTO);
                var listItem = this.itemTransacaoService.getByIdTransacao(transacao.id_transacao);
                (await listItem).forEach(async itemTransacao => {
                    this.saveDetalhes(itemTransacao, await headerLoteDTO);
                });
            }
       });       
    }  

    public async findOne(
        fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
    ): Promise<NullableType<HeaderArquivo>> {
        return await this.headerArquivoRepository.findOne({
            where: fields,
        });
    }

    public async findAll(): Promise<HeaderArquivo[]> {
        return await this.headerArquivoRepository.findAll();
    }

    private async transacaoToHeaderArquivo(transacao: Transacao,tipo_arquivo:string)
    :Promise<HeaderArquivoDTO>{
        var dto = new HeaderArquivoDTO();
        var pagador =  await this.pagadorService.findById(transacao.id_pagador);
        dto.agencia = pagador.agencia;
        dto.cod_banco = this.COD_BANCO;
        dto.cod_convenio = this.CONVENIO_BANCO;
        dto.dt_geracao = transacao.dt_ordem; 
        dto.dv_agencia = pagador.dv_agencia
        dto.dv_conta = pagador.dv_conta
        dto.hr_geracao = transacao.dt_ordem
        dto.id_transacao = transacao.id_transacao;
        dto.nome_empresa = pagador.nome_empresa;
        dto.num_conta = pagador.conta;
        dto.num_inscricao = this.NUM_INSCRICAO;
        dto.param_transmissao = this.PARAM_TRANSMISSAO;
        dto.tipo_arquivo = tipo_arquivo;
        dto.tipo_inscricao = this.TIPO_INSCRICAO;
        return dto;
    }

    private async transacaoToHeaderLote(transacao: Transacao,headerArquivoDTO: HeaderArquivoDTO)
    :Promise<HeaderLoteDTO>{
        var dto = new HeaderLoteDTO();
        dto.cod_convenio_banco = headerArquivoDTO.cod_convenio;
        dto.id_header_arquivo = headerArquivoDTO.id_header_arquivo;
        dto.id_pagadora = transacao.id_pagador;
        //autoincremento no banco => dto.lote_servico = ;
        dto.num_inscricao = headerArquivoDTO.num_inscricao;
        dto.param_transmissao = headerArquivoDTO.param_transmissao;
        dto.tipo_compromisso = this.TIPO_COMPROMISSO;
        dto.tipo_inscricao = headerArquivoDTO.tipo_inscricao;   
        return dto;     
    }

    private async saveDetalhes(itemTransacao: ItemTransacao,headerLoteDTO:HeaderLoteDTO)
    :Promise<void>{
        var detalheA = new DetalheADTO();
        detalheA.data_efetivacao = itemTransacao.dt_transacao;
        detalheA.dt_vencimento = itemTransacao.dt_processamento;  
        detalheA.id_header_lote = headerLoteDTO.id_header_lote;
        detalheA.indicador_bloqueio = this.INDICADOR_BLOQUEIO ;
        detalheA.id_cliente_favorecido = itemTransacao.id_cliente_favorecido; 
        detalheA.indicador_forma_parcelamento = this.FORMA_PARCELAMENTO;
        detalheA.lote_servico = headerLoteDTO.lote_servico;
        //detalheA.num_doc_lancamento = this.geraLoteServico(); autoincrementar no banco
        detalheA.periodo_vencimento = itemTransacao.dt_processamento;
        detalheA.num_parcela = this.NUM_PARCELA;
        detalheA.qtde_parcelas = this.NUM_PARCELA;
        detalheA.tipo_finalidade_conta = this.FINALIDADE;
        detalheA.tipo_moeda = this.MOEDA;
        detalheA.valor_lancamento = itemTransacao.valor_item_transacao;
        detalheA.valor_real_efetivado = itemTransacao.valor_item_transacao;
        var saveDetalheA = this.detalheAService.save(detalheA); 

        var detalheB = new DetalheBDTO();
        detalheB.data_vencimento = itemTransacao.dt_processamento;
       // detalheB.nsr = // this.geraLoteServico(); auto incrementar no banco // pegar da geracao do arquivo e salvar
        detalheB.id_detalhe_a = (await saveDetalheA).id_detalhe_a;    
        this.detalheBService.save(detalheB);            
    }

    private verficaHeaderArquivo(id_transacao:number):boolean{
        var ret = this.headerArquivoRepository.findOne(id_transacao);
        if(ret == null){
           return false;
        }
        return true;
    }
}