import { Injectable } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { Info } from 'src/domain/entity/info.entity';

@Injectable()
export class InfoService {
  constructor(
    @InjectRepository(Info)
    private readonly infoRepository: Repository<Info>,
  ) {}

  async find(fields?: EntityCondition<Info>): Promise<Nullable<Info[]>> {
    return this.infoRepository.find({
      where: fields,
    });
  }

  async findByVersion(version: string): Promise<Info[]> {
    // If no version found, return empty to indicate it
    const count = await this.infoRepository.count({
      where: { version: version },
    });

    if (count === 0) {
      return [];
    }

    // Otherwise, return settings for given version and for any version (null)
    return this.infoRepository.find({
      where: [{ version: version }, { version: IsNull() }],
    });
  }
}
