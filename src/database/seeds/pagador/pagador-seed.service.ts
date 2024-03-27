import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { Repository } from 'typeorm';
import { pagadorSeedData } from './pagador-seed-data';

@Injectable()
export class PagadorSeedService {
  constructor(
    @InjectRepository(Pagador)
    private repository: Repository<Pagador>,
  ) { }

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    const items = pagadorSeedData;
    for (const pagador of items) {
      await this.repository.save(pagador);
    }
  }
}
