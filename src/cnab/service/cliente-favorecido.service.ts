import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { BigqueryOrdemPagamentoDTO } from 'src/bigquery/dtos/bigquery-ordem-pagamento.dto';
import { LancamentoEntity } from 'src/lancamento/lancamento.entity';
import { TipoFavorecidoEnum } from 'src/tipo-favorecido/tipo-favorecido.enum';
import { User } from 'src/users/entities/user.entity';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { asString } from 'src/utils/pipe-utils';
import { getStringUpperUnaccent } from 'src/utils/string-utils';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { validateDTO } from 'src/utils/validation-utils';
import { FindOneOptions, In } from 'typeorm';
import { SaveClienteFavorecidoDTO } from '../dto/cliente-favorecido.dto';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { ClienteFavorecidoRepository } from '../repository/cliente-favorecido.repository';

@Injectable()
export class ClienteFavorecidoService {
  private logger: Logger = new Logger('ClienteFavorecidoService', {
    timestamp: true,
  });

  constructor(
    private clienteFavorecidoRepository: ClienteFavorecidoRepository,
  ) {}

  /**
   * All ClienteFavoecidos will be created or updated from users based of cpfCnpj.
   *
   * It also updates
   *
   * @returns All favorecidos after update
   */
  public async updateAllFromUsers(allUsers: User[]): Promise<void> {
    // this.clienteFavorecidoRepository.
    const saveFavorecidos = await this.getManyFavorecidoDTOsFromUsers(allUsers);
    const newFavorecidos = saveFavorecidos.map((i) => {
      if (i.nome) {
        i.nome = getStringUpperUnaccent(i.nome).trim();
      }
      return i;
    });
    await this.clienteFavorecidoRepository.upsert(newFavorecidos);
  }

  public async findCpfCnpj(cpfCnpj: string): Promise<ClienteFavorecido | null> {
    return await this.clienteFavorecidoRepository.findOne({
      where: { cpfCnpj: cpfCnpj },
    });
  }

  public async findManyFromLancamentos(
    lancamentos: LancamentoEntity[],
  ): Promise<ClienteFavorecido[]> {
    const ids = [...new Set(lancamentos.map((i) => i.id_cliente_favorecido))];
    return await this.clienteFavorecidoRepository.findMany({
      where: {
        id: In(ids),
      },
    });
  }

  public async findManyFromOrdens(
    ordens: BigqueryOrdemPagamentoDTO[],
  ): Promise<ClienteFavorecido[]> {
    const documentos = ordens.reduce(
      (l, i) => [
        ...l,
        ...(i.consorcioCnpj ? [i.consorcioCnpj] : []),
        ...(i.operadoraCpfCnpj ? [i.operadoraCpfCnpj] : []),
      ],
      [],
    );
    const uniqueDocumentos = [...new Set(documentos)];
    return await this.clienteFavorecidoRepository.findMany({
      where: {
        cpfCnpj: In(uniqueDocumentos),
      },
    });
  }

  public async getCpfCnpj(cpf_cnpj: string): Promise<ClienteFavorecido> {
    return await this.clienteFavorecidoRepository.getOne({ cpfCnpj: cpf_cnpj });
  }

  public async getAll(): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.findAll();
  }

  public async getOneByIdClienteFavorecido(
    idClienteFavorecido: number,
  ): Promise<ClienteFavorecido> {
    const cliente_favorecido = await this.clienteFavorecidoRepository.getOne({
      id: idClienteFavorecido,
    });
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
    const cliente_favorecido = await this.clienteFavorecidoRepository.findAll();
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

  private async getManyFavorecidoDTOsFromUsers(
    users: User[],
    existingId_facorecido?: number,
  ): Promise<SaveClienteFavorecidoDTO[]> {
    const newItems: SaveClienteFavorecidoDTO[] = [];
    for (const user of users) {
      const newItem: SaveClienteFavorecidoDTO = {
        id: existingId_facorecido,
        nome: asString(user.fullName),
        cpfCnpj: asString(user.cpfCnpj),
        codigoBanco: String(user.getBankCode()),
        agencia: (user.bankAgency as string).padStart(5, '0'),
        dvAgencia: '',
        contaCorrente: user.getBankAccount().trim().padStart(12, '0'),
        dvContaCorrente: user.getBankAccountDigit().trim(),
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: null,
        cep: null,
        complementoCep: null,
        uf: null,
        tipo: TipoFavorecidoEnum.operadora,
      };
      await validateDTO(SaveClienteFavorecidoDTO, newItem);
      newItems.push(newItem);
    }
    return newItems;
  }

  private async saveFavorecidoFromUser(
    user: User,
    existingId_facorecido?: number,
  ): Promise<void> {
    const saveObject: SaveClienteFavorecidoDTO = {
      id: existingId_facorecido,
      nome: asString(user.fullName),
      cpfCnpj: asString(user.cpfCnpj),
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
      tipo: TipoFavorecidoEnum.operadora,
    };
    await validateDTO(SaveClienteFavorecidoDTO, saveObject);
    await this.clienteFavorecidoRepository.save(saveObject);
  }

  public async getOne(
    fields: EntityCondition<ClienteFavorecido>,
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

  public async findOneByNome(nome: string): Promise<ClienteFavorecido | null> {
    return await this.clienteFavorecidoRepository.findOneByNome(nome);
  }

  public async findOne(
    options: FindOneOptions<ClienteFavorecido>,
  ): Promise<ClienteFavorecido | null> {
    return await this.clienteFavorecidoRepository.findOne(options);
  }
}
