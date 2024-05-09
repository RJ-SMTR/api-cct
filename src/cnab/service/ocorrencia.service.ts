import { Injectable, Logger } from '@nestjs/common';

import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';
import { OcorrenciaRepository } from 'src/cnab/repository/ocorrencia.repository';
import { DeepPartial } from 'typeorm';

@Injectable()
export class OcorrenciaService {
  private logger: Logger = new Logger(OcorrenciaService.name, {
    timestamp: true,
  });

  constructor(private tOcorrenciaRepository: OcorrenciaRepository) {}

  /**
   * Save Transacao if NSA not exists
   */
  public async save(dto: DeepPartial<Ocorrencia>): Promise<Ocorrencia> {
    return await this.tOcorrenciaRepository.save(dto);
  }

  public async saveMany(ocorrencias: DeepPartial<Ocorrencia>[]) {
    return this.tOcorrenciaRepository.insert(ocorrencias);
  }
}
