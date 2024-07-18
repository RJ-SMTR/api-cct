import { Injectable, Logger } from '@nestjs/common';
import {
  addDays,
  isDate,  
  isThursday,
  nextFriday,
  startOfDay,
} from 'date-fns';
import { asNumber } from 'src/utils/pipe-utils';
import { FindManyOptions } from 'typeorm';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';
import { ItemTransacao } from '../entity/pagamento/item-transacao.entity';
import { Ocorrencia } from '../entity/pagamento/ocorrencia.entity';
import { ArquivoPublicacaoRepository } from '../repository/arquivo-publicacao.repository';
import { OcorrenciaService } from './ocorrencia.service';
import { ItemTransacaoService } from './pagamento/item-transacao.service';

@Injectable()
export class ArquivoPublicacaoService {
  private logger: Logger = new Logger('ArquivoPublicacaoService', {
    timestamp: true,
  });

  constructor(    
    private arquivoPublicacaoRepository: ArquivoPublicacaoRepository,    
    private transacaoOcorrenciaService: OcorrenciaService,
    private itemTransacaoService: ItemTransacaoService,
  ) { }
  
  public findMany(options: FindManyOptions<ArquivoPublicacao>) {
    return this.arquivoPublicacaoRepository.findMany(options);
  }

  public async findManyByDate(startDate: Date, endDate: Date) {
    return await this.arquivoPublicacaoRepository.findManyByDate(
      startDate,
      endDate,
    );
  }

  /**
   * Generates a new ArquivoPublicacao.
   *
   * **status** is Created.
   */
  async convertPublicacaoDTO(
    itemTransacao: ItemTransacao,
  ): Promise<ArquivoPublicacao> {
    const existing = await this.arquivoPublicacaoRepository.findOne({
      where: {
        itemTransacao: {
          id: itemTransacao.id,
        },
      },
    });
    const ordem = itemTransacao.dataOrdem;
    if (!isDate(ordem) || !ordem) {
      console.warn('erro');
    }

    /** Como é data relativa, se for quinta, pega a sexta da próxima semana */
    const friday = isThursday(ordem) ? addDays(ordem, 8) : nextFriday(ordem);

    const arquivo = new ArquivoPublicacao({
      ...(existing ? { id: existing.id } : {}),
      // Remessa
      idTransacao: asNumber(itemTransacao.transacao?.id),
      itemTransacao: { id: itemTransacao.id },
      // Retorno
      isPago: false,
      dataGeracaoRetorno: null,
      horaGeracaoRetorno: null,
      dataVencimento: startOfDay(friday),
      dataEfetivacao: null,
      valorRealEfetivado: null,
    });
    return arquivo;
  }

  public async save(itemTransacaoAg: ItemTransacao): Promise<ArquivoPublicacao> {
    const publicacao = await this.convertPublicacaoDTO(itemTransacaoAg);
    return await this.arquivoPublicacaoRepository.save(publicacao);
  }

  /**
   * updateFromRemessaRetorno()
   *
   * From Remessa and Retorno, save new ArquivoPublicacao
   *
   * This task will:
   * 1. Find all new Remessa
   * 2. For each remessa get corresponding Retorno, HeaderLote and Detalhes
   * 3. For each DetalheA, save new ArquivoPublicacao if not exists
   */
  public async compareRemessaToRetorno(detalheA: DetalheA): Promise<void> {
    //Inclui ocorrencias
    await this.salvaOcorrenciasDetalheA(detalheA);
    //Atualiza publicação
    await this.savePublicacaoRetorno(detalheA);   
  }

  async salvaOcorrenciasDetalheA(detalheARetorno: DetalheA) {
    if (!detalheARetorno.ocorrenciasCnab) {
      return;
    }
    const ocorrencias = Ocorrencia.fromCodesString(
      detalheARetorno.ocorrenciasCnab,
    );
    // Update
    for (const ocorrencia of ocorrencias) {
      ocorrencia.detalheA = detalheARetorno;
    }
    if (ocorrencias.length === 0) {
      return;
    }
    await this.transacaoOcorrenciaService.saveMany(ocorrencias);
  }

  /**
   * Atualizar publicacoes de retorno
   */
  async savePublicacaoRetorno(detalheARetorno: DetalheA) {
    const itens = await this.itemTransacaoService.findMany({
      where: {
        itemTransacaoAgrupado: {
          id: detalheARetorno.itemTransacaoAgrupado.id,
        },
      },
    });
    for (const item of itens) {
      const publicacao = await this.arquivoPublicacaoRepository.getOne({
        where: {
          itemTransacao: {
            id: item.id,
          },
        },
      });
      publicacao.isPago = detalheARetorno.isPago();
      if (publicacao.isPago) {
        publicacao.valorRealEfetivado = publicacao.itemTransacao.valor;
        publicacao.dataEfetivacao = detalheARetorno.dataEfetivacao;
      }
      publicacao.dataGeracaoRetorno =
        detalheARetorno.headerLote.headerArquivo.dataGeracao;
      publicacao.horaGeracaoRetorno =
        detalheARetorno.headerLote.headerArquivo.horaGeracao;

      await this.arquivoPublicacaoRepository.save(publicacao);
    }
  }
}
