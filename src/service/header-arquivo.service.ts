import { Injectable } from '@nestjs/common';
import { TransacaoAgrupado } from 'src/domain/entity/transacao-agrupado.entity';
import { SettingsService } from 'src/configuration/settings/settings.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import {  DeepPartial, FindOptionsWhere } from 'typeorm';
import { HeaderArquivoDTO } from '../domain/dto/header-arquivo.dto';
import { HeaderArquivo } from '../domain/entity/header-arquivo.entity';
import { HeaderArquivoTipoArquivo } from '../domain/enum/header-arquivo-tipo-arquivo.enum';
import { HeaderArquivoRepository } from '../repository/header-arquivo.repository';
import { PagadorService } from './pagador.service';
import { HeaderArquivoStatus, HeaderName } from 'src/domain/enum/header-arquivo-status.enum';

@Injectable()
export class HeaderArquivoService {
 
  public async getHeaderArquivoNsa(index: number) {
    return this.getOne({ nsa: index });
  }

  private logger = new CustomLogger('HeaderArquivoService', { timestamp: true });

  constructor(
    private headerArquivoRepository: HeaderArquivoRepository, //
    private pagadorService: PagadorService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Generate new HaderArquivo from Transacao
   */
  public async newCreatedDTO(tipo_arquivo: HeaderArquivoTipoArquivo, transacaoAg: TransacaoAgrupado, isTeste?: boolean): Promise<HeaderArquivoDTO> {
    const pagador = await this.pagadorService.getOneByIdPagador(transacaoAg?.pagador.id);
    const nsa = await this.settingsService.getNextNSA(isTeste);
    return HeaderArquivoDTO.newCreated(tipo_arquivo, transacaoAg, pagador, nsa, false, isTeste);
  }

  public async findOne(fields: FindOptionsWhere<HeaderArquivo> | FindOptionsWhere<HeaderArquivo>[]): Promise<HeaderArquivo | null> {
    return (await this.headerArquivoRepository.findOne({ where: fields })) || null;
  }

  public async findMany(fields: FindOptionsWhere<HeaderArquivo> | FindOptionsWhere<HeaderArquivo>[]): Promise<HeaderArquivo[]> {
    return this.headerArquivoRepository.findMany({ where: fields });
  }

  /**
   * key: HeaderArquivo unique id
   */
  public saveManyIfNotExists(dtos: HeaderArquivoDTO[]): Promise<HeaderArquivo[]> {
    return this.headerArquivoRepository.saveManyIfNotExists(dtos);
  }

  public async saveIfNotExists(dto: HeaderArquivoDTO): Promise<SaveIfNotExists<HeaderArquivo>> {
    return await this.headerArquivoRepository.saveIfNotExists(dto);
  }

  public async save(dto: DeepPartial<HeaderArquivo>): Promise<HeaderArquivo> {
    return await this.headerArquivoRepository.save(dto);
  }

  public async getOne(fields: EntityCondition<HeaderArquivo>): Promise<HeaderArquivo> {
    return await this.headerArquivoRepository.getOne(fields);
  }

  public async getExists(status: HeaderArquivoStatus, remessaName: HeaderName) {
    return await this.headerArquivoRepository.getHeaderArquivo(status,remessaName);
  }
}
