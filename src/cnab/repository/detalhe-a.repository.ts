import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Repository } from 'typeorm';
import { DetalheADTO } from '../dto/detalhe-a.dto';
import { DetalheA } from '../entity/detalhe-a.entity';

@Injectable()
export class DetalheARepository {
  private logger: Logger = new Logger('DetalheARepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(DetalheA)
    private detalheARepository: Repository<DetalheA>,
  ) { }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    return await this.detalheARepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<DetalheA[]> {
    return await this.detalheARepository.find({
      where: fields,
    });
  }

  /**
   * Get next 'Número Documento Atribuído pela Empresa'.
   * 
   * For each registro A, J etc in the same date, you must set unique number from 1 then add 1.
   * 
   * > Número do Documento Atribuído pela Empresa - número do agendamento atribuído pela empresa.
   * > Este número deverá evoluir de 1 em 1 para cada registro dentro do arquivo.
   */
  public async getNextNumeroDocumento(dataEfetivacao: Date): Promise<number> {
    const result = await this.detalheARepository
      .createQueryBuilder('detalheA')
      .select('MAX(detalheA.num_doc_lancamento)', 'maxNumDocLancamento')
      .where('detalheA.data_efetivacao = :dataEfetivacao', { dataEfetivacao })
      .getRawOne();

    const maxNumDocLancamento = result.maxNumDocLancamento || 0;
    return maxNumDocLancamento + 1;
  }
}
