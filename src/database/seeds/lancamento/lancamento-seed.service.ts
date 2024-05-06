import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { In, Repository } from 'typeorm';
import { LancamentoSeedDataService } from './lancamento-seed-data.service';

@Injectable()
export class LancamentoSeedService {
  constructor(
    @InjectRepository(LancamentoEntity)
    private lancamentoRepository: Repository<LancamentoEntity>,
    private lancamentoSeedDataService: LancamentoSeedDataService,
  ) { }

  async validateRun() {
    return Promise.resolve(global.force);
  }

  async run() {
    const { fixtures } = await this.lancamentoSeedDataService.getData();
    const descricoes = fixtures.map(i => i.descricao);
    // Remove existing seeds
    await this.lancamentoRepository.delete({ descricao: In(descricoes) });
    const newItems: LancamentoEntity[] = [];
    for (const fixture of fixtures) {
      newItems.push(new LancamentoEntity(fixture));
    }
    await this.lancamentoRepository.upsert(newItems, { conflictPaths: { id: true } });
  }
}
