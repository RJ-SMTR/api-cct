import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Lancamento } from 'src/domain/entity/lancamento.entity';
import { In, Repository } from 'typeorm';
import { LancamentoSeedDataService } from './lancamento-seed-data.service';

@Injectable()
export class LancamentoSeedService {
  constructor(
    @InjectRepository(Lancamento)
    private lancamentoRepository: Repository<Lancamento>,
    private lancamentoSeedDataService: LancamentoSeedDataService,
  ) {}

  async validateRun() {
    return Promise.resolve(global.force);
  }

  async run() {
    const { fixtures } = await this.lancamentoSeedDataService.getData();
    const descricoes = fixtures.map((i) => i.numero_processo);
    // Remove existing seeds
    await this.lancamentoRepository.delete({ numero_processo: In(descricoes) });
    const newItems: Lancamento[] = [];
    for (const fixture of fixtures) {
      newItems.push(new Lancamento(fixture));
    }
    await this.lancamentoRepository.upsert(newItems, { conflictPaths: { id: true } });
  }
}
