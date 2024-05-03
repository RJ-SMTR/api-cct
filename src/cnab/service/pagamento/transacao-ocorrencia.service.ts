
import { Injectable, Logger } from '@nestjs/common';

import { TransacaoOcorrencia } from 'src/cnab/entity/pagamento/transacao-ocorrencia.entity';
import { TransacaoOcorrenciaRepository } from 'src/cnab/repository/pagamento/transacao-ocorrencia.repository';
import { DeepPartial } from 'typeorm';

@Injectable()
export class TransacaoOcorrenciaService {
  private logger: Logger = new Logger(TransacaoOcorrenciaService.name, {
    timestamp: true,
  });

  constructor(private tOcorrenciaRepository: TransacaoOcorrenciaRepository) {}

  /**
   * Save Transacao if NSA not exists
   */
  public async save(dto: DeepPartial<TransacaoOcorrencia>): Promise<TransacaoOcorrencia> {
    return await this.tOcorrenciaRepository.save(dto);
  }

  public async saveMany(ocorrencias: DeepPartial<TransacaoOcorrencia>[]) {
    return this.tOcorrenciaRepository.insert(ocorrencias);
  }

}
