import { Injectable, Logger } from '@nestjs/common';

import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { OcorrenciaRepository } from 'src/cnab/repository/ocorrencia.repository';
import { DeepPartial, FindManyOptions } from 'typeorm';

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

  public async saveMany(ocorrencias: DeepPartial<Ocorrencia>[]) {
    for (const ocorrencia of ocorrencias) {
      return this.ocorrenciaRepository.save(ocorrencia);
      
    }
  }
}
