import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Exception } from 'handlebars';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { LancamentoSeedData } from 'src/lancamento/interfaces/lancamento-seed-data.interface';
import { User } from 'src/users/entities/user.entity';
import { getBRTFromUTC } from 'src/utils/date-utils';
import { Repository } from 'typeorm';

@Injectable()
export class LancamentoSeedDataService {
  nodeEnv = (): string => '';

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ClienteFavorecido)
    private favorecidosRepository: Repository<ClienteFavorecido>,
  ) {
    this.nodeEnv = () => this.configService.getOrThrow('app.nodeEnv', { infer: true });
  }

  async getData() {
    // Get user_ids
    const users = await this.usersRepository.find({
      take: 3,
    });
    if (users.length < 3) {
      throw new Exception(`Expected 3 users but got ${users.length}.` + 'Did you seed this before seeding Users?');
    }
    const userIds = users.reduce((l, i) => [...l, i.id], []);

    // Get id_favorecidos
    const favorecidos = await this.favorecidosRepository.find({
      take: 2,
    });
    if (users.length < 2) {
      throw new Exception(`Expected 2 Favorecidos but got ${favorecidos.length}.` + 'Did you seed this before seeding ClienteFavorecidos?');
    }
    const today = getBRTFromUTC(new Date());
    const seedTag = '[SEED] ';

    const fixtures = [
      // Development only
      ...(this.nodeEnv() === 'local' || this.nodeEnv() === 'test'
        ? ([
            {
              algoritmo: '1',
              clienteFavorecido: { id: favorecidos[0].id },
              data_lancamento: today,
              data_ordem: today,
              data_pgto: today,
              glosa: 1,
              numero_processo: seedTag + 'Unapproved',
              recurso: 1,
              valor: 110,
              valor_a_pagar: 110,
              autor: { id: users[0].id },
              anexo: 1,
            },
            {
              algoritmo: '2',
              clienteFavorecido: { id: favorecidos[0].id },
              data_lancamento: today,
              data_ordem: today,
              data_pgto: today,
              glosa: 2,
              numero_processo: seedTag + 'Approved 1',
              recurso: 2,
              valor: 951,
              valor_a_pagar: 951,
              autor: { id: users[0].id },
              autorizado_por: userIds.slice(0, 1).join(','),
              anexo: 1,
            },
            {
              algoritmo: 2,
              clienteFavorecido: { id: favorecidos[0].id },
              data_lancamento: today,
              data_ordem: today,
              data_pgto: today,
              glosa: 2,
              numero_processo: seedTag + 'Approved 2',
              recurso: 2,
              valor: 951.12,
              valor_a_pagar: 951.12,
              autor: { id: users[0].id },
              autorizado_por: userIds.slice(0, 2).join(','),
              anexo: 1,
            },
            {
              algoritmo: 3,
              clienteFavorecido: { id: favorecidos[0].id },
              data_lancamento: today,
              data_ordem: today,
              data_pgto: today,
              glosa: 2,
              numero_processo: seedTag + 'Approved 2 again',
              recurso: 2,
              valor: 1034.01,
              valor_a_pagar: 1034.01,
              autor: { id: users[0].id },
              autorizado_por: userIds.slice(0, 2).join(','),
              anexo: 1,
            },
          ] as LancamentoSeedData[])
        : []),
    ];
    return {
      fixtures,
      seedTag,
    };
  }
}
