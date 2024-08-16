import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  InsertResult,
  Repository,
  SelectQueryBuilder,
  UpdateResult,
} from 'typeorm';
import { SaveClienteFavorecidoDTO } from '../dto/cliente-favorecido.dto';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { IClienteFavorecidoFindBy } from '../interfaces/cliente-favorecido-find-by.interface';
import { Pagination } from 'src/utils/types/pagination.type';
import { getPagination } from 'src/utils/get-pagination';

@Injectable()
export class ClienteFavorecidoRepository {
  private logger: Logger = new CustomLogger(ClienteFavorecidoRepository.name, {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ClienteFavorecido)
    private clienteFavorecidoRepository: Repository<ClienteFavorecido>,
  ) {}

  createQueryBuilder = this.clienteFavorecidoRepository.createQueryBuilder;

  async remove(favorecidos: ClienteFavorecido[]) {
    return await this.clienteFavorecidoRepository.remove(favorecidos);
  }
  
  async save(dto: SaveClienteFavorecidoDTO): Promise<void> {
    if (dto.id === undefined) {
      await this.create(dto);
    } else {
      await this.update(dto.id, dto);
    }
  }

  public async findOneByNome(nome: string): Promise<ClienteFavorecido | null> {
    const cliente = await this.clienteFavorecidoRepository
      .createQueryBuilder('favorecido')
      .where(
        'unaccent(UPPER("favorecido"."nome")) ILIKE unaccent(UPPER(:nome))',
        { nome: `%${nome}%` },
      )
      .getOne();

    return cliente;
  }

  clear() {
    return this.clienteFavorecidoRepository.clear();
  }

  async create(
    createProfileDto: SaveClienteFavorecidoDTO,
  ): Promise<ClienteFavorecido> {
    const createdUser = await this.clienteFavorecidoRepository.save(
      this.clienteFavorecidoRepository.create(createProfileDto),
    );
    this.logger.log(`ClienteFavorecido criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async upsert(
    favorecidos: DeepPartial<ClienteFavorecido>[],
  ): Promise<InsertResult> {
    const payload = await this.clienteFavorecidoRepository.upsert(favorecidos, {
      conflictPaths: { cpfCnpj: true },
      skipUpdateIfNoValuesChanged: true,
    });
    this.logger.log(
      `${payload.identifiers.length} ClienteFavorecidos atualizados.`,
    );
    return payload;
  }

  async update(
    id: number,
    updateDto: SaveClienteFavorecidoDTO,
  ): Promise<UpdateResult> {
    const updatePayload = await this.clienteFavorecidoRepository.update(
      { id: id },
      updateDto,
    );
    const updatedItem = new ClienteFavorecido({
      id: id,
      ...updateDto,
    });
    this.logger.log(
      `ClienteFavorecido atualizado: ${updatedItem.getLogInfo()}`,
    );
    return updatePayload;
  }

  public async getOne(
    fields: EntityCondition<ClienteFavorecido>,
  ): Promise<ClienteFavorecido> {
    const result = await this.clienteFavorecidoRepository.findOne({
      where: fields,
    });
    if (!result) {
      throw CommonHttpException.notFound(Object.entries(fields).join(','));
    } else return result;
  }

  public async findAll(): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.find();
  }
  public async findMany(
    options: FindManyOptions<ClienteFavorecido>,
  ): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.find(options);
  }

  public async findManyBy(
    where?: IClienteFavorecidoFindBy,
  ): Promise<ClienteFavorecido[]> {
    let isFirstWhere = false;
    let qb = this.clienteFavorecidoRepository.createQueryBuilder('favorecido');
    function cmd() {
      if (isFirstWhere) {
        isFirstWhere = false;
        return 'where';
      } else {
        return 'andWhere';
      }
    }
    if (where?.nome?.length) {
      for (const nome of where.nome) {
        qb = qb[cmd()]('favorecido."nome" ILIKE UNACCENT(UPPER(:nome))', {
          nome: `%${nome}%`,
        });
      }
    }

    if (where?.limit && where?.page) {
      const skip = where?.limit * (where?.page - 1);
      qb = qb.take(where?.limit).skip(skip);
    }
    qb = qb.orderBy('"id"', 'ASC');

    const result = await qb.getMany();
    return result;
  }

  public async findOne(
    options: FindOneOptions<ClienteFavorecido>,
  ): Promise<ClienteFavorecido | null> {
    const first = (
      await this.clienteFavorecidoRepository.find(options)
    ).shift();
    return first || null;
  }
}
