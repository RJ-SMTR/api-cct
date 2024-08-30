import { Injectable, Logger } from '@nestjs/common';
import { TransacaoDTO } from '../../dto/pagamento/transacao.dto';
import { Transacao } from '../../entity/pagamento/transacao.entity';
import { TransacaoRepository } from '../../repository/pagamento/transacao.repository';

import { isFriday, nextFriday } from 'date-fns';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { PagadorContaEnum } from 'src/cnab/enums/pagamento/pagador.enum';
import { Lancamento } from 'src/lancamento/entities/lancamento.entity';
import { asNumber, asString } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, FindManyOptions, QueryRunner, UpdateResult } from 'typeorm';

@Injectable()
export class TransacaoService {
  private logger: Logger = new Logger(TransacaoService.name, {
    timestamp: true,
  });

  constructor(private transacaoRepository: TransacaoRepository) {}

  async findMany(options: FindManyOptions<Transacao>) {
    return await this.transacaoRepository.findMany(options);
  }

  async findOne(fields: EntityCondition<Transacao>) {
    return await this.transacaoRepository.findOne(fields);
  }

  /**
   * **status** is Created.
   *
   * It will automatically update Lancamentos via OneToMany
   *
   * @param newLancamentos It must have at least 1 unused Lancamento
   */
  public generateDTOForLancamento(pagador: Pagador, newLancamentos: Lancamento[]): Transacao {
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);
    const transacao = new Transacao({
      dataOrdem: friday,
      dataPagamento: null,
      lancamentos: newLancamentos, // unique id for Lancamentos
      pagador: { id: pagador.id } as Pagador,
    });
    return transacao;
  }

  public update(dto: DeepPartial<Transacao>) {
    return this.transacaoRepository.update(asNumber(dto.id), dto);
  }

  // #region generateDTOsFromPublicacoes

  // public generateDTOsFromPublicacoes(
  //   publicacoes: ArquivoPublicacao[],
  //   pagador: Pagador,
  // ) {
  //   const transacoes: Transacao[] = [];
  //   /** key: idOrdemPagamento */
  //   const transacaoMap: Record<string, Transacao> = {};
  //   for (const publicacao of publicacoes) {
  //     const transacaoPK = publicacao.idOrdemPagamento;
  //     const newTransacao = this.generateDTOFromPublicacao(publicacao, pagador);
  //     if (!transacaoMap[transacaoPK]) {
  //       transacoes.push(newTransacao);
  //       transacaoMap[transacaoPK] = newTransacao;
  //     }
  //   }
  //   return transacoes;
  // }

  /**
   * getTransacaoFromOrdem()
   *
   * **status** is Created.
   */
  // public generateDTOFromPublicacao(
  //   publicacao: ArquivoPublicacao,
  //   pagador: Pagador,
  // ): Transacao {
  //   const transacao = new Transacao({
  //     dataOrdem: publicacao.dataOrdem,
  //     dataPagamento: null,
  //     idOrdemPagamento: publicacao.idOrdemPagamento, // unique id for Ordem
  //     pagador: { id: pagador.id } as Pagador,
  //     status: new TransacaoStatus(TransacaoStatusEnum.created),
  //     ocorrencias: [],
  //   });
  //   return transacao;
  // }

  // #endregion

  /**
   * Use first Transacao as set to update and all Transacoes to get ids.
   */
  public updateMany(transacoes: DeepPartial<Transacao>[]): Promise<UpdateResult> {
    const ids = transacoes.reduce((l, i) => [...l, asNumber(i.id)], []);
    const set = transacoes[0];
    if ('id' in set) {
      delete set['id'];
    }
    return this.transacaoRepository.updateMany(ids, set);
  }

  public saveManyIfNotExists(transacoes: DeepPartial<Transacao>[]): Promise<Transacao[]> {
    return this.transacaoRepository.saveManyIfNotExists(transacoes);
  }

  public async saveMany(transacoes: DeepPartial<Transacao>[]): Promise<Transacao[]> {
    const insertResult = await this.transacaoRepository.insert(transacoes);
    return await this.transacaoRepository.findMany({
      where: insertResult.identifiers,
    });
  }

  /**
   * Save Transacao for Lancamento
   */
  public async saveForLancamento(dto: TransacaoDTO): Promise<Transacao> {
    await validateDTO(TransacaoDTO, dto);
    const saved = await this.transacaoRepository.save(dto);
    this.setLazyLancamentos([saved]);
    return saved;
  }

  /**
   * Set lazy value (only id) to transacao.lancamentos
   */
  private setLazyLancamentos(transacoes: Transacao[]) {
    for (const transacao of transacoes) {
      for (const lancamento of transacao.lancamentos || []) {
        lancamento.transacao = { id: transacao.id } as Transacao;
      }
    }
  }

  /**
   * Save Transacao if Jae unique column not exists
   */
  public async saveForJaeIfNotExists(dto: TransacaoDTO): Promise<SaveIfNotExists<Transacao>> {
    await validateDTO(TransacaoDTO, dto);
    const transacao = await this.transacaoRepository.findOne({
      idOrdemPagamento: asString(dto.idOrdemPagamento),
    });
    if (transacao) {
      return {
        isNewItem: false,
        item: transacao,
      };
    } else {
      return {
        isNewItem: true,
        item: await this.transacaoRepository.save(dto),
      };
    }
  }

  /**
   * Save Transacao if NSA not exists
   */
  public async save(dto: TransacaoDTO, queryRunner: QueryRunner): Promise<Transacao> {
    await validateDTO(TransacaoDTO, dto);
    return await queryRunner.manager.getRepository(Transacao).save(dto);
  }

  public async getAll(): Promise<Transacao[]> {
    return await this.transacaoRepository.findAll();
  }

  /**
   * Get all transacao where id not exists in headerArquivo yet (new CNABS)
   */
  public async findAllNewTransacao(tipo: PagadorContaEnum): Promise<Transacao[]> {
    return await this.transacaoRepository.findAllNewTransacao(tipo);
  }
}
