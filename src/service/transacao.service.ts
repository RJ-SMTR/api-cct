import { Injectable } from '@nestjs/common';
import { TransacaoDTO } from '../domain/dto/transacao.dto';
import { Transacao } from '../domain/entity/transacao.entity';
import { TransacaoRepository } from '../repository/transacao.repository';


import { DeepPartial, FindManyOptions, QueryRunner, UpdateResult } from 'typeorm';
import { PagadorContaEnum } from 'src/domain/enum/pagador.enum';
import { CustomLogger } from 'src/utils/custom-logger';
import { asNumber, asString } from 'src/utils/pipe-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';

@Injectable()
export class TransacaoService {
  private logger = new CustomLogger(TransacaoService.name, { timestamp: true });

  constructor(private transacaoRepository: TransacaoRepository) {}

  async findMany(options: FindManyOptions<Transacao>) {
    return await this.transacaoRepository.findMany(options);
  }

  async findOne(fields: EntityCondition<Transacao>) {
    return await this.transacaoRepository.findOne(fields);
  }

  public update(dto: DeepPartial<Transacao>) {
    return this.transacaoRepository.update(asNumber(dto.id), dto);
  }

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
