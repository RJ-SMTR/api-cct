import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import {
    Repository,
    UpdateResult
} from 'typeorm';
import { DetalheA } from '../entity/detalhe-a.entity';
import { DetalheADTO } from '../dto/detalhe-a.dto';


@Injectable()
export class DetalheARepository {
    private logger: Logger = new Logger('DetalheARepository', { timestamp: true });

    constructor(
        @InjectRepository(DetalheA)
        private DetalheARepository: Repository<DetalheA>,
    ) { }

    public async save(dto: DetalheADTO): Promise<DetalheA> {
       return await this.DetalheARepository.save(dto);               
    }  

    public async findOne(
        fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
    ): Promise<NullableType<DetalheA>> {
        return await this.DetalheARepository.findOne({
            where: fields,
        });
    }

    public async findMany(
        fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
    ): Promise<DetalheA[]> {
        return await this.DetalheARepository.find({
            where: fields,
        });
    }

}