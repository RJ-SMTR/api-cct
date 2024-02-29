import { Injectable, Logger } from '@nestjs/common';
import { InjectService } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { NullableType } from 'src/utils/types/nullable.type';
import { HeaderArquivo } from '../entity/header-arquivo.entity';
import { HeaderArquivoDTO } from '../dto/header-arquivo.dto';
import { HeaderArquivoRepository } from '../repository/header-arquivo.repository';
import { TransacaoService } from './transacao.service';
import { Transacao } from '../entity/transacao.entity';
import { ItemTransacaoService } from './Item-transacao.service';


@Injectable()
export class HeaderArquivoService {
    private logger: Logger = new Logger('HeaderArquivoService', { timestamp: true });

    constructor(
        @InjectService(HeaderArquivo)
        private headerArquivoRepository: HeaderArquivoRepository,
        private transacaoService:TransacaoService,
        private itemTransacaoService:ItemTransacaoService
    ) { }

    public async save(dto: HeaderArquivoDTO): Promise<void> {
       var listAllTransacao = await this.transacaoService.getAllTransacao();
       listAllTransacao.forEach(transacao=>{
            var listItem = itemTransacaoService.getByTransacao(transacao.id_transacao);
            listItem.forEach(item => {
                
            });
       });
       await this.headerArquivoRepository.save(dto);   

    }  


    public async findOne(
        fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
    ): Promise<NullableType<HeaderArquivo>> {
        return await this.headerArquivoRepository.findOne({
            where: fields,
        });
    }

    public async findMany(
        fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
    ): Promise<HeaderArquivo[]> {
        return await this.headerArquivoRepository.find({
            where: fields,
        });
    }

    private validateDTO(dto:HeaderArquivoDTO):boolean{
        return true;
    }

}



