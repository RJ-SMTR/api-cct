import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import {
    Repository
} from 'typeorm';
import { ItemTransacao } from '../entity/item-transacao.entity';
import { ItemTransacaoDTO } from '../dto/item-transacao.dto';


@Injectable()
export class ItemTransacaoRepository {
    [x: string]: any;
    private logger: Logger = new Logger('ItemTransacaoRepository', { timestamp: true });

    constructor(
        @InjectRepository(ItemTransacao)
        private ItemTransacaoRepository: Repository<ItemTransacao>,
    ) { }

    public async save(dto: ItemTransacaoDTO): Promise<ItemTransacao> {
       return await this.ItemTransacaoRepository.save(dto);               
    }  

    public async findOne(
        fields: EntityCondition<ItemTransacao> | EntityCondition<ItemTransacao>[],
    ): Promise<NullableType<ItemTransacao>> {
        return await this.ItemTransacaoRepository.findOne({
            where: fields,
        });
    }

    public async findAll(
        fields: EntityCondition<ItemTransacao> | EntityCondition<ItemTransacao>[],
    ): Promise<ItemTransacao[]> {
        return await this.ItemTransacaoRepository.find({
            where: fields,
        });
    }
}