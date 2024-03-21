import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { FindOptionsOrder, In, Repository } from 'typeorm';
import { HeaderArquivoDTO } from '../../dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { asNumber } from 'src/utils/pipe-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';

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

  public async saveIfNotExists(dto: HeaderArquivoDTO): Promise<SaveIfNotExists<HeaderArquivo>> {
    const existingHeader = await this.headerArquivoRepository.findOne({
      where: {
        nsa: dto.nsa,
        transacao: { id: dto.transacao?.id },
        tipoArquivo: asNumber(dto.tipoArquivo)
      }
    });
    if (existingHeader) {
      return {
        isNewItem: false,
        item: existingHeader,
      };
    } else {
      return {
        isNewItem: true,
        item: await this.headerArquivoRepository.save(dto),
      };
    }
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

  public async findMany(fields: EntityCondition<HeaderArquivo> | EntityCondition<HeaderArquivo>[]): Promise<HeaderArquivo[]> {
    return await this.headerArquivoRepository.find({
      where: fields
    });
  }

  /**
   * Find HeaderArquivo Remessa where id not exists yet in ArquivoPublicacao
   */
  public async findAllNewRemessa(): Promise<HeaderArquivo[]> {
    // Find new remessa
    const ids: number[] = (await this.headerArquivoRepository.query(
      'SELECT ha.id ' +
      'FROM header_arquivo ha ' +
      'LEFT JOIN arquivo_publicacao ap ON ap."headerArquivoId" = ha.id ' +
      'LEFT JOIN transacao t ON t."id" = ha."transacaoId" ' +
      'WHERE ha."tipoArquivo" = 1 -- REMESSA ' +
      'AND ap."headerArquivoId" IS NULL '
    )).map((item: { id: number; }) => item.id);
    // Retrieve Entities with eager
    return await this.headerArquivoRepository.find({
      where: { id: In(ids) }
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
