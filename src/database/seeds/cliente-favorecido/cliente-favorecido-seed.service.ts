import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClienteFavorecidoSeedData } from './cliente-favorecido-seed-data';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { parseStringUpperUnaccent } from 'src/utils/string-utils';

@Injectable()
export class ClienteFavorecidoSeedService {
  constructor(
    @InjectRepository(ClienteFavorecido)
    private repository: Repository<ClienteFavorecido>,
  ) {}

  async validateRun() {
    return Promise.resolve(true);
  }

  async run() {
    const items = ClienteFavorecidoSeedData;
    for (const favorecido of items) {
      favorecido.nome = parseStringUpperUnaccent(favorecido.nome);
      const existing = await this.repository.findOne({
        where: { cpfCnpj: favorecido.cpfCnpj },
      });
      if (existing) {
        favorecido.id = existing.id;
      }
      await this.repository.save(favorecido);
    }
  }
}
