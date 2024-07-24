import { Injectable, Logger } from '@nestjs/common';
import { addDays, isDate, isThursday, nextFriday, startOfDay } from 'date-fns';
import { asNumber } from 'src/utils/pipe-utils';
import { DeepPartial, FindManyOptions } from 'typeorm';
import { ArquivoPublicacao } from '../entity/arquivo-publicacao.entity';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';
import { ItemTransacao } from '../entity/pagamento/item-transacao.entity';
import { ArquivoPublicacaoRepository } from '../repository/arquivo-publicacao.repository';

@Injectable()
export class ArquivoPublicacaoService {
  private logger: Logger = new Logger('ArquivoPublicacaoService', {
    timestamp: true,
  });

  constructor(
    private arquivoPublicacaoRepository: ArquivoPublicacaoRepository, // private cnabService: CnabService
  ) {}

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
   * Generates a new ArquivoPublicacao from ItemTransacao
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

  public async save(
    dto: DeepPartial<ArquivoPublicacao>,
  ): Promise<ArquivoPublicacao> {
    return await this.arquivoPublicacaoRepository.save(dto);
  }

  /**
   * Publicacao está associada com a ordem, portanto é sex-qui
   */
  async getPublicacoesWeek(detalheA: DetalheA) {
    const result = await this.findMany({
      where: {
        itemTransacao: {
          itemTransacaoAgrupado: { id: detalheA.itemTransacaoAgrupado.id },
        },
      },
    });
    return result;
  }

  async getOne(options: FindManyOptions<ArquivoPublicacao>) {
    return await this.arquivoPublicacaoRepository.getOne(options);
  }
}
