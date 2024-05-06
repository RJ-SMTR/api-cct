import { Injectable, Logger } from '@nestjs/common';
import { HeaderArquivoDTO } from 'src/cnab/dto/pagamento/header-arquivo.dto';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { Transacao } from 'src/cnab/entity/pagamento/transacao.entity';
import { CnabLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial } from 'typeorm';
import { HeaderLoteDTO } from '../../dto/pagamento/header-lote.dto';
import { HeaderLote } from '../../entity/pagamento/header-lote.entity';
import { HeaderLoteRepository } from '../../repository/pagamento/header-lote.repository';
import { PagadorService } from './pagador.service';
import { TransacaoAgrupado } from 'src/cnab/entity/pagamento/transacao-agrupado.entity';

const PgtoRegistros = Cnab104PgtoTemplates.file104.registros;

@Injectable()
export class HeaderLoteService {
  private logger: Logger = new Logger('HeaderLoteService', { timestamp: true });

  constructor(
    private headerLoteRepository: HeaderLoteRepository,
    private pagadorService: PagadorService,
  ) { }

  /**
   * From Transacao, HeaderArquivo transforms into HeaderLote.
   * 
   * `loteServico` should be set later before save!
   * 
   */
  public getDTO(
    headerArquivo: HeaderArquivoDTO,
    transacao?: Transacao,
    transacaoAg?: TransacaoAgrupado,
  ): HeaderLote {
    const dto = new HeaderLote({
      codigoConvenioBanco: headerArquivo.codigoConvenio,
      pagador: transacao?.pagador || transacaoAg?.pagador,
      numeroInscricao: headerArquivo.numeroInscricao,
      parametroTransmissao: headerArquivo.parametroTransmissao,
      tipoCompromisso: String(PgtoRegistros.headerLote.tipoCompromisso.value),
      tipoInscricao: headerArquivo.tipoInscricao,
      headerArquivo: headerArquivo,
    });
    return dto;
  }

  public async saveFrom104(lote: CnabLote104Pgto, headerArquivo: HeaderArquivo,
  ): Promise<SaveIfNotExists<HeaderLote>> {
    const pagador = await this.pagadorService.getByConta(lote.headerLote.numeroConta.value);
    const headerLote = new HeaderLoteDTO({
      headerArquivo: { id: headerArquivo.id },
      loteServico: lote.headerLote.loteServico.convertedValue,
      codigoConvenioBanco: lote.headerLote.codigoConvenioBanco.stringValue,
      numeroInscricao: lote.headerLote.numeroInscricao.stringValue,
      parametroTransmissao: lote.headerLote.parametroTransmissao.stringValue,
      tipoCompromisso: lote.headerLote.tipoCompromisso.stringValue,
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

  public async save(dto: HeaderLoteDTO): Promise<HeaderLote> {
    await validateDTO(HeaderLoteDTO, dto);
    return await this.headerLoteRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<HeaderLote>,
  ): Promise<Nullable<HeaderLote>> {
    return await this.headerLoteRepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<HeaderLote>,
  ): Promise<HeaderLote[]> {
    return await this.headerLoteRepository.findMany({ where: fields });
  }
}