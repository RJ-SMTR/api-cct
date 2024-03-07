import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { ClienteFavorecidoRepository } from '../repository/cliente-favorecido.repository';
import { SaveClienteFavorecidoDTO } from '../dto/cliente-favorecido.dto';
import { validateDTO } from 'src/utils/validation-utils';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';

@Injectable()
export class ClienteFavorecidoService {
  private logger: Logger = new Logger('ClienteFavorecidoService', {
    timestamp: true
  });

  constructor(
    private usersService: UsersService,
    private clienteFavorecidoRepository: ClienteFavorecidoRepository,
  ) { }

  /**
   * All ClienteFavoecidos will be created or updated from users based of cpfCnpj.
   * @returns All favorecidos after update
   */
  public async updateAllFromUsers(): Promise<void> {
    const allUsers = await this.usersService.findMany({});
    for (const user of allUsers) {
      const favorecido = await this.clienteFavorecidoRepository.getOne({
        cpfCnpj: user.getCpfCnpj(),
      });
      await this.saveFavorecidoFromUser(
        user,
        favorecido?.id,
      );
    }
  }


  public async getCpfCnpj(cpf_cnpj: string): Promise<ClienteFavorecido> {
    return await this.clienteFavorecidoRepository.getOne({ cpfCnpj: cpf_cnpj });
  }


  public async getAll(): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.findAll({});
  }

  public async getOneByIdClienteFavorecido(
    id_cliente_favorecido: number,
  ): Promise<ClienteFavorecido> {
    const cliente_favorecido = 
    await this.clienteFavorecidoRepository.getOne({ id_cliente_favorecido: id_cliente_favorecido });
    if (!cliente_favorecido) {
      throw CommonHttpException.errorDetails(
        'cliente_favorecido.conta not found',
        { pagadorConta: id_cliente_favorecido },
        HttpStatus.NOT_FOUND,
      );
    } else {
      return cliente_favorecido;
    }
  }

  private async saveFavorecidoFromUser(
    user: User,
    existingId_facorecido?: number,
  ): Promise<void> {
    const saveObject: SaveClienteFavorecidoDTO = {
      id_cliente_favorecido: existingId_facorecido,
      nome: user.getFullName(),
      cpfCnpj: user.getCpfCnpj(),
      codBanco: String(user.getBankCode()),
      agencia: user.getBankAgencyWithoutDigit(),
      dvAgencia: user.getBankAgencyDigit(),
      contaCorrente: user.getBankAccount(),
      dvContaCorrente: user.getBankAccountDigit(),
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      cep: null,
      complementoCep: null,
      uf: null,
    };
    await validateDTO(SaveClienteFavorecidoDTO, saveObject);
    await this.clienteFavorecidoRepository.save(saveObject);
  }

  public async findOne(
    fields: EntityCondition<ClienteFavorecido> | EntityCondition<ClienteFavorecido>[],
  ): Promise<Nullable<ClienteFavorecido>> {
    return await this.clienteFavorecidoRepository.getOne(fields);
  }

}