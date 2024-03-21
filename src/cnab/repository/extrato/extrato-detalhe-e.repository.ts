import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, startOfDay } from 'date-fns';
import { ExtratoDetalheE } from 'src/cnab/entity/extrato/extrato-detalhe-e.entity';
import { Nullable } from 'src/utils/types/nullable.type';
import { DeepPartial, FindManyOptions, FindOneOptions, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class ExtratoDetalheERepository {
  private logger: Logger = new Logger('ExtratoDetalheERepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ExtratoDetalheERepository)
    private detalheARepository: Repository<ExtratoDetalheE>,
  ) { }

  public async save(obj: DeepPartial<ExtratoDetalheE>): Promise<ExtratoDetalheE> {
    return await this.detalheARepository.save(obj);
  }

  public async findOne(options: FindOneOptions<ExtratoDetalheE>): Promise<Nullable<ExtratoDetalheE>> {
    const one = await this.detalheARepository.findOne(options);
    return one;
  }

  public async findMany(options: FindManyOptions<ExtratoDetalheE> ): Promise<ExtratoDetalheE[]> {
    const many = await this.detalheARepository.find(options);
    return many;
  }

  /**
   * Obtém o próximo'Número Documento Atribuído pela Empresa' para o ExtratoDetalheE.
   * 
   * Baseado no mesmo dia.
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.detalheARepository.count({
      where: [
        { createdAt: MoreThanOrEqual(startOfDay(date)) },
        { createdAt: LessThanOrEqual(endOfDay(date)) },
      ]
    }) + 1;
  }
}
