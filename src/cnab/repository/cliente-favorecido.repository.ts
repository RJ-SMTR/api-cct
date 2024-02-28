import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { formatLog } from 'src/utils/logging';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { Repository, UpdateResult } from 'typeorm';
import { SaveClienteFavorecidoDto } from '../dto/save-cliente-favorecido.dto';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';
import { UpdateCreateClienteFavorecidoDto } from '../interfaces/cliente-favorecido/update-cliente-favorecido.dto';

@Injectable()
export class ClienteFavorecidoRepository {
  private logger: Logger = new Logger('ClienteFavorecidoRepository', {
    timestamp: true,
  });
  private ENTITY_NAME = ClienteFavorecido.name;

  constructor(
    @InjectRepository(ClienteFavorecido)
    private clienteFavorecidoRepository: Repository<ClienteFavorecido>,
  ) {}

  async save(dto: SaveClienteFavorecidoDto): Promise<ClienteFavorecido> {
    if (dto.id_cliente_favorecido === undefined) {
      this.clienteFavorecidoRepository.create(dto);
    } else {
      await this.update(dto.id_cliente_favorecido, dto);
    }
    const createdUser = await this.clienteFavorecidoRepository.save(
      this.clienteFavorecidoRepository.create(dto),
    );
    this.logger.log(`${this.ENTITY_NAME} criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async create(
    createProfileDto: SaveClienteFavorecidoDto,
  ): Promise<ClienteFavorecido> {
    const createdUser = await this.clienteFavorecidoRepository.save(
      this.clienteFavorecidoRepository.create(createProfileDto),
    );
    this.logger.log(`Usuário criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async update(
    id: number,
    updateDto: SaveClienteFavorecidoDto,
    logContext?: string,
    logOldFavorecido?: ClienteFavorecido,
  ): Promise<UpdateResult> {
    const updatePayload = await this.clienteFavorecidoRepository.update(
      { id_cliente_favorecido: id },
      updateDto,
    );
    if (logOldFavorecido) {
      this.logUpdateFavorecido(logOldFavorecido, updateDto, logContext);
    }

    return updatePayload;
  }

  private logUpdateFavorecido(
    old: ClienteFavorecido,
    updateDto: UpdateCreateClienteFavorecidoDto,
    outerContext?: string,
  ) {
    const logMsg =
      `Favorecido ${old.getLogInfo(false)} teve seus campos atualizados: ` +
      `[${Object.keys(updateDto)} ]`;
    this.logger.log(formatLog(logMsg, 'update()', outerContext));
  }

  public async findOne(
    fields:
      | EntityCondition<ClienteFavorecido>
      | EntityCondition<ClienteFavorecido>[],
  ): Promise<NullableType<ClienteFavorecido>> {
    return await this.clienteFavorecidoRepository.findOne({
      where: fields,
    });
  }

  public async findMany(
    fields:
      | EntityCondition<ClienteFavorecido>
      | EntityCondition<ClienteFavorecido>[],
  ): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.find({
      where: fields,
    });
  }
}
