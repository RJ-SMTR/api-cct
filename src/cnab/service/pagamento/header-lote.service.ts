import { Injectable, Logger } from '@nestjs/common';
import { HeaderArquivoDTO } from 'src/cnab/dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { Pagador } from 'src/cnab/entity/pagamento/pagador.entity';
import { Cnab104FormaLancamento } from 'src/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { CnabLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial } from 'typeorm';
import { HeaderLoteDTO } from '../../dto/pagamento/header-lote.dto';
import { HeaderLote } from '../../entity/pagamento/header-lote.entity';
import { HeaderLoteRepository } from '../../repository/pagamento/header-lote.repository';
import { PagadorService } from './pagador.service';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';

@Injectable()
export class HeaderLoteService {
  private logger: Logger = new Logger('HeaderLoteService', { timestamp: true });

  constructor(
    private headerLoteRepository: HeaderLoteRepository, //
    private pagadorService: PagadorService,
  ) {}

  public async saveFrom104(
    lote: CnabLote104Pgto, //
    headerArquivoUpdated: HeaderArquivo,
  ): Promise<SaveIfNotExists<HeaderLote>> {
    const pagador = await this.pagadorService.getByConta(lote.headerLote.numeroConta.value);
    const headerLoteRem = await this.headerLoteRepository.findOne({
      headerArquivo: { id: headerArquivoUpdated.id },
      loteServico: lote.headerLote.loteServico.convertedValue,
    });
    const headerLote = new HeaderLote({
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
    return await this.headerLoteRepository.saveIfNotExists(headerLote);
  }

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public saveManyIfNotExists(dtos: DeepPartial<HeaderLote>[]): Promise<HeaderLote[]> {
    return this.headerLoteRepository.saveManyIfNotExists(dtos);
  }

  public async save(dto: DeepPartial<HeaderLote>): Promise<HeaderLote> {
    // await validateDTO(HeaderLoteDTO, dto);
    return await this.headerLoteRepository.save(dto);
  }

  public async saveDto(dto: HeaderLoteDTO): Promise<HeaderLote> {
    return await this.headerLoteRepository.save(dto);
  }

  public async findOne(fields: EntityCondition<HeaderLote>): Promise<Nullable<HeaderLote>> {
    return await this.headerLoteRepository.findOne(fields);
  }

  public async findMany(fields: EntityCondition<HeaderLote>): Promise<HeaderLote[]> {
    return await this.headerLoteRepository.findMany({ where: fields });
  }
}
