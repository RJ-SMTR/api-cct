import { Injectable, Logger } from '@nestjs/common';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';
import { CnabLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { HeaderLoteDTO } from '../../dto/pagamento/header-lote.dto';
import { HeaderLote } from '../../entity/pagamento/header-lote.entity';
import { HeaderLoteRepository } from '../../repository/pagamento/header-lote.repository';
import { PagadorService } from './pagador.service';

@Injectable()
export class HeaderLoteService {
  private logger: Logger = new Logger('HeaderLoteService', { timestamp: true });

  constructor(
    private headerLoteRepository: HeaderLoteRepository,
    private pagadorService: PagadorService,
  ) { }

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

  public async save(dto: HeaderLoteDTO): Promise<HeaderLote> {
    await validateDTO(HeaderLoteDTO, dto);
    return await this.headerLoteRepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
  ): Promise<Nullable<HeaderLote>> {
    return await this.headerLoteRepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<HeaderLote> | EntityCondition<HeaderLote>[],
  ): Promise<HeaderLote[]> {
    return await this.headerLoteRepository.findMany(fields);
  }
}
