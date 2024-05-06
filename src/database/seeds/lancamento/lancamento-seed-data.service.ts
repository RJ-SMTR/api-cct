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
    this.nodeEnv = () =>
      this.configService.getOrThrow('app.nodeEnv', { infer: true });
  }

  async getData() {
    // Get user_ids
    const users = await this.usersRepository.find({
      take: 3
    });
    if (users.length < 3) {
      throw new Exception(`Expected 3 users but got ${users.length}.` +
        'Did you seed this before seeding Users?');
    }
    const userIds = users.reduce((l, i) => [...l, i.id], []);

    // Get id_favorecidos
    const favorecidos = await this.favorecidosRepository.find({
      take: 2
    });
    if (users.length < 2) {
      throw new Exception(`Expected 2 Favorecidos but got ${favorecidos.length}.` +
        'Did you seed this before seeding ClienteFavorecidos?');
    }
    const today = getBRTFromUTC(new Date());
    const seedTag = '[SEED] ';

    const fixtures = [
      // Development only
      ...(this.nodeEnv() === 'local' || this.nodeEnv() === 'test'
        ? ([
          {
            algoritmo: '1',
            descricao: seedTag + 'Unapproved',
            id_cliente_favorecido: { id: favorecidos[0].id },
            data_lancamento: today,
            data_ordem: today,
            data_pgto: today,
            glosa: '1',
            numero_processo: '1',
            recurso: '1',
            valor: 110,
            valor_a_pagar: 110,
            userId: users[0].id,
            user: { id: users[0].id },
            anexo: '1',
          },
          {
            algoritmo: '2',
            descricao: seedTag + 'Approved 1',
            id_cliente_favorecido: { id: favorecidos[0].id },
            data_lancamento: today,
            data_ordem: today,
            data_pgto: today,
            glosa: '2',
            numero_processo: '2',
            recurso: '2',
            valor: 951,
            valor_a_pagar: 951,
            userId: users[0].id,
            user: { id: users[0].id },
            auth_usersIds: userIds.slice(0, 1).join(','),
            anexo: '1',
          },
          {
            algoritmo: 2,
            descricao: seedTag + 'Approved 2',
            id_cliente_favorecido: { id: favorecidos[0].id },
            data_lancamento: today,
            data_ordem: today,
            data_pgto: today,
            glosa: '2',
            numero_processo: '2',
            recurso: '2',
            valor: 951.12,
            valor_a_pagar: 951.12,
            userId: users[0].id,
            user: { id: users[0].id },
            auth_usersIds: userIds.slice(0, 2).join(','),
            anexo: '1',
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
