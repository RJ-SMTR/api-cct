import { Injectable, Logger } from '@nestjs/common';
import { InjectService } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import {
    Service,
    UpdateResult
} from 'typeorm';
import { HeaderLote } from '../entity/header-lote.entity';
import { HeaderLoteDTO } from '../dto/header-lote.dto';
import { HeaderLoteRepository } from '../repository/header-lote.repository';


@Injectable()
export class HeaderLoteService {
    private logger: Logger = new Logger('HeaderLoteService', { timestamp: true });

    constructor(
        @InjectService(HeaderLote)
        private headerLoteRepository: HeaderLoteRepository
    ) { }

    public async save(dto: HeaderLoteDTO): Promise<void> {        
       await this.headerLoteRepository.save(dto);       
    }  


    public async findOne(
        fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
    ): Promise<NullableType<HeaderLote>> {
        return await this.headerLoteRepository.findOne({
            where: fields,
        });
    }

    public async findMany(
        fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
    ): Promise<HeaderLote[]> {
        return await this.headerLoteRepository.find({
            where: fields,
        });
    }

    private validateDTO(dto:HeaderLoteDTO):boolean{
        return true;
    }

}



