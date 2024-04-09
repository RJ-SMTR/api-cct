import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HeaderArquivoStatusEnum } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { HeaderArquivoTipoArquivo } from 'src/cnab/enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { FindOptionsOrder, In, Repository } from 'typeorm';
import { HeaderArquivoDTO } from '../../dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { logWarn } from 'src/utils/log-utils';

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

  /**
   * Any DTO existing in db will be ignored.
   * 
   * @param dtos DTOs that can exist or not in database 
   * @returns Saved objects not in database.
   */
  public async saveManyIfNotExists(dtos: HeaderArquivoDTO[]): Promise<HeaderArquivo[]> {
    // Existing
    const existing = await this.headerArquivoRepository.find({
      where: dtos.reduce((l, i) => [...l, {
        nsa: i.nsa,
        tipoArquivo: i.tipoArquivo
      }], [])
    });
    const existingMap: Record<string, HeaderArquivoDTO> =
      existing.reduce((m, i) => ({ ...m, [`${i.nsa}|${i.tipoArquivo}`]: i }), {});
    // Check
    if (existing.length === dtos.length) {
      logWarn(this.logger, `${existing.length}/${dtos.length} HeaderArquivos já existem, nada a fazer...`);
    } else if (existing.length) {
      logWarn(this.logger, `${existing.length}/${dtos.length} HeaderArquivos já existem, ignorando...`);
      return [];
    }
    // Save new
    const newDTOs =
      dtos.reduce((l, i) => [...l, ...!existingMap[HeaderArquivo.getUniqueId(i)] ? [i] : []], []);
    const insert = await this.headerArquivoRepository.insert(newDTOs);
    // Return saved
    const insertIds = (insert.identifiers as { id: number }[]).reduce((l, i) => [...l, i.id], []);
    const saved = await this.findMany({ id: In(insertIds) });
    return saved;
  }

  public async saveIfNotExists(dto: HeaderArquivoDTO): Promise<SaveIfNotExists<HeaderArquivo>> {
    const existing = await this.headerArquivoRepository.findOne({
      where: {
        nsa: dto.nsa,
        tipoArquivo: dto.tipoArquivo,
      }
    });
    const item = existing || await this.headerArquivoRepository.save(dto);
    return {
      isNewItem: !Boolean(existing),
      item: item,
    }
  }

  public async getOne(
    fields: EntityCondition<HeaderArquivo>,
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
    fields: EntityCondition<HeaderArquivo>,
  ): Promise<HeaderArquivo | null> {
    return await this.headerArquivoRepository.findOne({
      where: fields,
    });
  }

  public async findMany(fields: EntityCondition<HeaderArquivo>): Promise<HeaderArquivo[]> {
    return await this.headerArquivoRepository.find({
      where: fields
    });
  }

  /**
   * Find HeaderArquivo Remessa ready to save in ArquivoPublicacao
   */
  public async findAllRemessaForPublicacao(): Promise<HeaderArquivo[]> {
    return await this.headerArquivoRepository.find({
      where: {
        tipoArquivo: HeaderArquivoTipoArquivo.Remessa,
        status: { id: HeaderArquivoStatusEnum.retornoSaved }
      }
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
