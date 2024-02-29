import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import {
    Repository,
    UpdateResult
} from 'typeorm';
import { HeaderLote } from '../entity/header-lote.entity';
import { HeaderLoteDTO } from '../dto/header-lote.dto';


@Injectable()
export class HeaderLoteRepository {
    private logger: Logger = new Logger('HeaderLoteRepository', { timestamp: true });

    constructor(
        @InjectRepository(HeaderLote)
        private HeaderLoteRepository: Repository<HeaderLote>,
    ) { }

    public async save(dto: HeaderLoteDTO): Promise<HeaderLote> {
       return await this.HeaderLoteRepository.save(dto);               
    }  

    public async findOne(
        fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
    ): Promise<NullableType<HeaderLote>> {
        return await this.HeaderLoteRepository.findOne({
            where: fields,
        });
    }

    public async findMany(
        fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
    ): Promise<HeaderLote[]> {
        return await this.HeaderLoteRepository.find({
            where: fields,
        });
    }

}