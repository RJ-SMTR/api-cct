import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CustomLogger } from 'src/utils/custom-logger';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  InsertResult,
  Repository,
  UpdateResult,
} from 'typeorm';
import { SaveClienteFavorecidoDTO } from '../dto/cliente-favorecido.dto';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';

@Injectable()
export class ClienteFavorecidoRepository {
  private logger: Logger = new CustomLogger(ClienteFavorecidoRepository.name, {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ClienteFavorecido)
    private clienteFavorecidoRepository: Repository<ClienteFavorecido>,
  ) {}

  async save(dto: SaveClienteFavorecidoDTO): Promise<void> {
    if (dto.id === undefined) {
      await this.create(dto);
    } else {
      await this.update(dto.id, dto);
    }
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

  public async findAll(
    fields: EntityCondition<ClienteFavorecido>,
  ): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.find({
      where: fields,
    });
  }

  public async findMany(
    options: FindManyOptions<ClienteFavorecido>,
  ): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.find(options);
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
