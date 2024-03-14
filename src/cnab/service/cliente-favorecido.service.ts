import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RoleEnum } from 'src/roles/roles.enum';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { validateDTO } from 'src/utils/validation-utils';
import { SaveClienteFavorecidoDTO } from '../dto/cliente-favorecido.dto';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { ClienteFavorecidoRepository } from '../repository/cliente-favorecido.repository';
import { IsNull, Not } from 'typeorm';

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
    const allUsers = await this.usersService.findMany({
      role: { id: RoleEnum.user, },
      fullName: Not(IsNull()),
      cpfCnpj: Not(IsNull()),
      bankCode: Not(IsNull()),
      bankAgency: Not(IsNull()),
      bankAccount: Not(IsNull()),
      bankAccountDigit: Not(IsNull()),
    });
    for (const user of allUsers) {
      const favorecido = await this.clienteFavorecidoRepository.findOne({
        cpfCnpj: user.cpfCnpj,
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
    idClienteFavorecido: number,
  ): Promise<ClienteFavorecido> {
    const cliente_favorecido =
      await this.clienteFavorecidoRepository.getOne({ id: idClienteFavorecido });
    if (!cliente_favorecido) {
      throw CommonHttpException.errorDetails(
        'cliente_favorecido.conta not found',
        { pagadorConta: idClienteFavorecido },
        HttpStatus.NOT_FOUND,
      );
    } else {
      return cliente_favorecido;
    }
  }

  public async getClienteFavorecido(): Promise<ClienteFavorecido[]> {
    const cliente_favorecido =
      await this.clienteFavorecidoRepository.findAll({});
    if (!cliente_favorecido) {
      throw CommonHttpException.errorDetails(
        'cliente_favorecido.conta not found',
        {},
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
      id: existingId_facorecido,
      nome: user.getFullName(),
      cpfCnpj: user.getCpfCnpj(),
      codigoBanco: String(user.getBankCode()),
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

  public async getOne(
    fields: EntityCondition<ClienteFavorecido> | EntityCondition<ClienteFavorecido>[],
  ): Promise<ClienteFavorecido> {
    const cliente = await this.clienteFavorecidoRepository.getOne(fields);
    if (!cliente) {
      throw CommonHttpException.errorDetails(
        'cliente_favorecido.conta not found',
        { pagadorConta: cliente },
        HttpStatus.NOT_FOUND,
      );
    } else {
      return cliente;
    }
  }

}