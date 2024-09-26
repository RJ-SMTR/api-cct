import { Injectable } from '@nestjs/common';
import { HeaderArquivoDTO } from 'src/cnab/dto/pagamento/header-arquivo.dto';
import { HeaderArquivoConf } from 'src/cnab/entity/conference/header-arquivo-conf.entity';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';
import { HeaderArquivoStatus } from 'src/cnab/enums/pagamento/header-arquivo-status.enum';
import { HeaderArquivoTipoArquivo } from 'src/cnab/enums/pagamento/header-arquivo-tipo-arquivo.enum';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { CnabFile104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { HeaderArquivoConfRepository } from 'src/cnab/repository/pagamento/header-arquivo-conf.repository';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { SettingsService } from 'src/settings/settings.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { PagadorService } from './pagador.service';

const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class HeaderArquivoConfService {
  private logger = new CustomLogger('HeaderArquivoConfService', { timestamp: true });

  constructor(
    private headerArquivoRepository: HeaderArquivoConfRepository, //
    private pagadorService: PagadorService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Gera um DTO com status criado
   */
  public async newCreatedDto(tipo_arquivo: HeaderArquivoTipoArquivo, transacaoAg: TransacaoAgrupado, isTeste?: boolean): Promise<HeaderArquivoDTO> {
    const pagador = await this.pagadorService.getOneByIdPagador(transacaoAg?.pagador.id);
    const nsa = await this.settingsService.getNextNSA(isTeste);
    return HeaderArquivoDTO.newCreated(tipo_arquivo, transacaoAg, pagador, nsa, true, isTeste);
  }

  /**
   * Find HeaderArquivoConf Remessa ready to save in ArquivoPublicacao
   */
  public async findRetornos(): Promise<HeaderArquivoConf[]> {
    return this.headerArquivoRepository.findMany({
      where: [
        {
          transacaoAgrupado: { status: { id: TransacaoStatusEnum.retorno } },
        },
      ],
    });
  }

  public async findOne(fields: FindOptionsWhere<HeaderArquivoConf> | FindOptionsWhere<HeaderArquivoConf>[]): Promise<HeaderArquivoConf | null> {
    return (await this.headerArquivoRepository.findOne({ where: fields })) || null;
  }

  public async findMany(fields: FindOptionsWhere<HeaderArquivoConf> | FindOptionsWhere<HeaderArquivoConf>[]): Promise<HeaderArquivoConf[]> {
    return this.headerArquivoRepository.findMany({ where: fields });
  }

  /**
   * key: HeaderArquivoConf unique id
   */
  public saveManyIfNotExists(dtos: HeaderArquivoDTO[]): Promise<HeaderArquivoConf[]> {
    return this.headerArquivoRepository.saveManyIfNotExists(dtos);
  }

  public async saveIfNotExists(dto: HeaderArquivoDTO): Promise<SaveIfNotExists<HeaderArquivoConf>> {
    return await this.headerArquivoRepository.saveIfNotExists(dto);
  }

  public async save(dto: DeepPartial<HeaderArquivoConf>): Promise<HeaderArquivoConf> {
    return await this.headerArquivoRepository.save(dto);
  }

  public async getOne(fields: EntityCondition<HeaderArquivoConf>): Promise<HeaderArquivoConf> {
    return await this.headerArquivoRepository.getOne(fields);
  }
}
