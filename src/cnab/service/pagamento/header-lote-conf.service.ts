import { Injectable, Logger } from '@nestjs/common';
import { HeaderLoteDTO } from 'src/cnab/dto/pagamento/header-lote.dto';
import { HeaderLoteConf } from 'src/cnab/entity/conference/header-lote-conf.entity';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { CnabLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface';
import { HeaderLoteConfRepository } from 'src/cnab/repository/pagamento/header-lote-conf.repository';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial } from 'typeorm';
import { PagadorService } from './pagador.service';
import { CustomLogger } from 'src/utils/custom-logger';

@Injectable()
export class HeaderLoteConfService {
  private logger = new CustomLogger('HeaderLoteConfService', { timestamp: true });

  constructor(
    private headerLoteConfRepository: HeaderLoteConfRepository, //
    private pagadorService: PagadorService,
  ) {}

  public async saveFrom104(lote: CnabLote104Pgto, headerArquivoUpdated: HeaderArquivo): Promise<SaveIfNotExists<HeaderLoteConf>> {
    const pagador = await this.pagadorService.getByConta(lote.headerLote.numeroConta.value);
    const headerLoteRem = await this.headerLoteConfRepository.findOne({
      headerArquivo: { id: headerArquivoUpdated.id },
      loteServico: lote.headerLote.loteServico.convertedValue,
    });
    const headerLote = new HeaderLoteConf({
      id: headerLoteRem?.id,
      headerArquivo: { id: headerArquivoUpdated.id },
      loteServico: lote.headerLote.loteServico.convertedValue,
      codigoConvenioBanco: lote.headerLote.codigoConvenioBanco.stringValue,
      numeroInscricao: lote.headerLote.numeroInscricao.stringValue,
      parametroTransmissao: lote.headerLote.parametroTransmissao.stringValue,
      tipoCompromisso: lote.headerLote.tipoCompromisso.stringValue,
      formaLancamento: lote.headerLote.formaLancamento.stringValue,
      tipoInscricao: lote.headerLote.tipoInscricao.stringValue,
      pagador: { id: pagador.id },
    });
    return await this.headerLoteConfRepository.saveIfNotExists(headerLote);
  }

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public saveManyIfNotExists(dtos: DeepPartial<HeaderLoteConf>[]): Promise<HeaderLoteConf[]> {
    return this.headerLoteConfRepository.saveManyIfNotExists(dtos);
  }

  public async save(dto: DeepPartial<HeaderLoteConf>): Promise<HeaderLoteConf> {
    // await validateDTO(HeaderLoteConfDTO, dto);
    return await this.headerLoteConfRepository.save(dto);
  }

  public async saveDto(dto: HeaderLoteDTO): Promise<HeaderLoteConf> {
    return await this.headerLoteConfRepository.save(dto);
  }

  public async findOne(fields: EntityCondition<HeaderLoteConf>): Promise<Nullable<HeaderLoteConf>> {
    return await this.headerLoteConfRepository.findOne(fields);
  }

  public async findMany(fields: EntityCondition<HeaderLoteConf>): Promise<HeaderLoteConf[]> {
    return await this.headerLoteConfRepository.findMany({ where: fields });
  }
}
