import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { FindOptionsOrder, Repository } from 'typeorm';
import { HeaderArquivoDTO } from '../dto/header-arquivo.dto';
import { HeaderArquivo } from '../entity/header-arquivo.entity';

@Injectable()
export class HeaderArquivoRepository {
  [x: string]: any;
  private logger: Logger = new Logger('HeaderArquivoRepository', {
    timestamp: true,
  });

  constructor(
    @InjectRepository(HeaderArquivo)
    private HeaderArquivoRepository: Repository<HeaderArquivo>,
  ) { }

  public async save(dto: HeaderArquivoDTO): Promise<HeaderArquivo> {
    return await this.HeaderArquivoRepository.save(dto);
  }

  public async getOne(
    fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
    order?: FindOptionsOrder<HeaderArquivo>
  ): Promise<HeaderArquivo> {
    const header = await this.HeaderArquivoRepository.findOne({
      where: fields,
      order: order,
    });
    if (!header) {
      throw CommonHttpException.invalidField(
        'HeaderArquivo',
        Object.values(fields).join(','),
        { errorMessage: 'not found.' }
      )
    } else {
      return header;
    }
  }

  public async findAll(fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[]): Promise<HeaderArquivo[]> {
    return await this.HeaderArquivoRepository.find({
      where: fields
    });
  }
}
