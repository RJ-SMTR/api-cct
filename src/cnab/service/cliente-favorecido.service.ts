import { Injectable, Logger } from '@nestjs/common';
import { User } from 'src/users/entities/user.entity';
import { UsersService } from 'src/users/users.service';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { ClienteFavorecidoRepository } from '../repository/cliente-favorecido.repository';
import { SaveClienteFavorecidoDTO } from '../dto/cliente-favorecido.dto';
import { validateDTO } from 'src/utils/validation-utils';

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
        cpf_cnpj: user.getCpfCnpj(),
      });
      await this.saveFavorecidoFromUser(
        user,
        favorecido?.id_cliente_favorecido,
      );
    }
  }


  public async getCpfCnpj(cpf_cnpj: string): Promise<ClienteFavorecido> {
    return await this.clienteFavorecidoRepository.getOne({ cpf_cnpj: cpf_cnpj });
  }


  public async getAll(): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.findAll({});
  }

  private async saveFavorecidoFromUser(
    user: User,
    existingId_facorecido?: number,
  ): Promise<void> {
    const saveObject: SaveClienteFavorecidoDTO = {
      id_cliente_favorecido: existingId_facorecido,
      nome: user.getFullName(),
      cpf_cnpj: user.getCpfCnpj(),
      cod_banco: String(user.getBankCode()),
      agencia: user.getBankAgencyWithoutDigit(),
      dv_agencia: user.getBankAgencyDigit(),
      conta_corrente: user.getBankAccount(),
      dv_conta_corrente: user.getBankAccountDigit(),
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      cep: null,
      complemento_cep: null,
      uf: null,
    };
    await validateDTO(SaveClienteFavorecidoDTO, saveObject);
    await this.clienteFavorecidoRepository.save(saveObject);
  }
}