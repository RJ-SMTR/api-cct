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
    private headerArquivoRepository: Repository<HeaderArquivo>,
  ) { }

  public async save(dto: HeaderArquivoDTO): Promise<HeaderArquivo> {
    return await this.headerArquivoRepository.save(dto);
  }

  public async getOne(
    fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
    order?: FindOptionsOrder<HeaderArquivo>
  ): Promise<HeaderArquivo> {
    const header = await this.headerArquivoRepository.findOne({
      where: fields,
      order: order,
    });
    if (!header) {
      const fieldsList = Object.values(fields).reduce((l, i) => [...l, String(i)], []);
      throw CommonHttpException.invalidField(
        'HeaderArquivo',
        fieldsList.join(','),
        { errorMessage: 'not found.' }
      )
    } else {
      return header;
    }
  }


  public async findOne(
    fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[],
  ): Promise<HeaderArquivo | null> {
    return await this.headerArquivoRepository.findOne({
      where: fields,
    });
  }

  public async findAll(fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[]): Promise<HeaderArquivo[]> {
    return await this.headerArquivoRepository.find({
      where: fields
    });
  }

  public async getNextNSA(): Promise<number> {
    const nsa = (await this.headerArquivoRepository.find({
      order: {
        nsa: 'DESC',
      },
      take: 1
    })).pop()?.nsa || 0;
    return nsa + 1;
  }
}
