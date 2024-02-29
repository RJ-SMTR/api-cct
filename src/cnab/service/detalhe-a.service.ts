import { Injectable, Logger } from '@nestjs/common';
import { InjectService } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import {
    Service,
    UpdateResult
} from 'typeorm';
import { DetalheA } from '../entity/detalhe-a.entity';
import { DetalheADTO } from '../dto/detalhe-a.dto';
import { DetalheARepository } from '../repository/detalhe-a.repository';


@Injectable()
export class DetalheAService {
    private logger: Logger = new Logger('DetalheAService', { timestamp: true });

    constructor(
        @InjectService(DetalheA)
        private detalheARepository: DetalheARepository
    ) { }

    public async save(dto: DetalheADTO): Promise<void> {        
       await this.detalheARepository.save(dto);       
    }  


    public async findOne(
        fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
    ): Promise<NullableType<DetalheA>> {
        return await this.detalheARepository.findOne({
            where: fields,
        });
    }

    public async findMany(
        fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
    ): Promise<DetalheA[]> {
        return await this.detalheARepository.find({
            where: fields,
        });
    }

    private validateDTO(dto:DetalheADTO):boolean{
        return true;
    }

}



