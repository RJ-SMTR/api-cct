import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Repository, UpdateResult } from 'typeorm';
import { SaveClienteFavorecidoDTO } from '../dto/cliente-favorecido.dto';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';

@Injectable()
export class ClienteFavorecidoRepository {

  private logger: Logger = new Logger('ClienteFavorecidoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(ClienteFavorecido)
    private clienteFavorecidoRepository: Repository<ClienteFavorecido>,
  ) { }

  async save(dto: SaveClienteFavorecidoDTO): Promise<void> {
    if (dto.id_cliente_favorecido === undefined) {
      await this.create(dto);
    } else {
      await this.update(dto.id_cliente_favorecido, dto);
    }
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

  async update(
    id: number,
    updateDto: SaveClienteFavorecidoDTO,
  ): Promise<UpdateResult> {
    const updatePayload = await this.clienteFavorecidoRepository.update(
      { id_cliente_favorecido: id },
      updateDto,
    );
    const updatedItem = new ClienteFavorecido({
      id_cliente_favorecido: id,
      ...updateDto,
    });
    this.logger.log(
      `ClienteFavorecido atualizado: ${updatedItem.getLogInfo()}`,
    );
    return updatePayload;
  }

  public async getOne(
    fields: EntityCondition<ClienteFavorecido> | EntityCondition<ClienteFavorecido>[],
  ): Promise<ClienteFavorecido> {
    const result = await this.clienteFavorecidoRepository.findOne({
      where: fields,
    });
    if (!result) {
      throw CommonHttpException.notFound(Object.keys(fields).join(','));
    }
    else return result;
  }

  public async findAll(
    fields:
      | EntityCondition<ClienteFavorecido>
      | EntityCondition<ClienteFavorecido>[],
  ): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.find({
      where: fields,
    });
  }
}
