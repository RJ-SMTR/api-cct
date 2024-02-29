import { Injectable, Logger } from '@nestjs/common';
import { InjectService } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { DetalheB } from '../entity/detalhe-b.entity';
import { DetalheBDTO } from '../dto/detalhe-b.dto';
import { DetalheBRepository } from '../repository/detalhe-b.repository';


@Injectable()
export class DetalheBService {
    private logger: Logger = new Logger('DetalheBService', { timestamp: true });

    constructor(
        @InjectService(DetalheB)
        private detalheBRepository: DetalheBRepository
    ) { }

    public async save(dto: DetalheBDTO): Promise<void> {        
       await this.detalheBRepository.save(dto);       
    }  


    public async findOne(
        fields: EntityCondition<DetalheB> | EntityCondition<DetalheB>[],
    ): Promise<NullableType<DetalheB>> {
        return await this.detalheBRepository.findOne({
            where: fields,
        });
    }

    public async findMany(
        fields: EntityCondition<DetalheB> | EntityCondition<DetalheB>[],
    ): Promise<DetalheB[]> {
        return await this.detalheBRepository.find({
            where: fields,
        });
    }

    private validateDTO(dto:DetalheBDTO):boolean{
        return true;
    }

}



