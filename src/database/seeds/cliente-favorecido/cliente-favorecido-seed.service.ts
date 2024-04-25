import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClienteFavorecidoSeedData } from './cliente-favorecido-seed-data';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';

@Injectable()
export class ClienteFavorecidoSeedService {
  constructor(
    @InjectRepository(ClienteFavorecido)
    private repository: Repository<ClienteFavorecido>,
  ) { }

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    const items = ClienteFavorecidoSeedData;
    for (const ClienteFavorecido of items) {
      await this.repository.save(ClienteFavorecido);
    }
  }
}
