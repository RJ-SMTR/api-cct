import { Injectable, Logger } from '@nestjs/common';
import { HeaderArquivo } from 'src/domain/entity/header-arquivo.entity';
import { CnabLote104Pgto } from 'src/configuration/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { DeepPartial } from 'typeorm';
import { HeaderLoteDTO } from '../domain/dto/header-lote.dto';
import { HeaderLote } from '../domain/entity/header-lote.entity';
import { HeaderLoteRepository } from '../repository/header-lote.repository';
import { PagadorService } from './pagador.service';

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

  public async findAll(headerArquivoId: number){
    return await this.headerLoteRepository.findAll(headerArquivoId)
  } 

  public async findByFormaLancamento(headerArquivoId: number,formaLancamento: string){
    return await this.headerLoteRepository.findByFormaLancamento(headerArquivoId,formaLancamento)
  } 
}
