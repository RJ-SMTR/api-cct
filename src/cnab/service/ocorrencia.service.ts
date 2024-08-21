import { Injectable, Logger } from '@nestjs/common';

import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { OcorrenciaRepository } from 'src/cnab/repository/ocorrencia.repository';
import { DeepPartial, FindManyOptions, FindOptionsWhere, QueryRunner } from 'typeorm';
import { DetalheA } from '../entity/pagamento/detalhe-a.entity';

@Injectable()
export class OcorrenciaService {
  private logger: Logger = new Logger(OcorrenciaService.name, {
    timestamp: true,
  });

  constructor(private ocorrenciaRepository: OcorrenciaRepository) {}

  async findMany(options: FindManyOptions<Ocorrencia>) {
    return await this.ocorrenciaRepository.findMany(options);
  }

  /**
   * Save Transacao if NSA not exists
   */
  public async save(dto: DeepPartial<Ocorrencia>): Promise<Ocorrencia> {
    return await this.ocorrenciaRepository.save(dto);
  }

  public async saveMany(ocorrencias: DeepPartial<Ocorrencia>[], queryRunner: QueryRunner) {
    const saved: Ocorrencia[] = [];
    for (const ocorrencia of ocorrencias) {
      saved.push(await queryRunner.manager.getRepository(Ocorrencia).save(ocorrencia));
    }
    return saved;
  }

  public async delete(detalheA: DeepPartial<DetalheA>, queryRunner: QueryRunner) {
    await queryRunner.manager.getRepository(Ocorrencia).delete({ detalheA: { id: detalheA.id } });
  }

  public async deleteBy(where: FindOptionsWhere<Ocorrencia>, queryRunner: QueryRunner) {
    await queryRunner.manager.getRepository(Ocorrencia).delete(where);
  }
}
