import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { FindOptionsOrder, Repository } from 'typeorm';
import { HeaderArquivo } from '../entity/header-arquivo.entity';
import { HeaderArquivoDTO } from '../dto/header-arquivo.dto';

@Injectable()
export class HeaderArquivoRepository {
  [x: string]: any;
  private logger: Logger = new Logger('HeaderArquivoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(HeaderArquivo)
    private HeaderArquivoRepository: Repository<HeaderArquivo>,
  ) {}

  public async save(dto: HeaderArquivoDTO): Promise<HeaderArquivo> {
    return await this.HeaderArquivoRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
    order?: FindOptionsOrder<HeaderArquivo>
  ): Promise<Nullable<HeaderArquivo>> {
    return await this.HeaderArquivoRepository.findOne({
      where: fields,
      order: order,
    });
  }

  public async findAll(): Promise<HeaderArquivo[]> {
    return await this.HeaderArquivoRepository.find();
  }
}