import { Injectable, Logger } from '@nestjs/common';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { HeaderLote } from '../../entity/pagamento/header-lote.entity';
import { HeaderLoteDTO } from '../../dto/pagamento/header-lote.dto';
import { HeaderLoteRepository } from '../../repository/pagamento/header-lote.repository';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { asString } from 'src/utils/pipe-utils';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { PagadorService } from './pagador.service';
import { CnabLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface';
import { HeaderArquivo } from 'src/cnab/entity/pagamento/header-arquivo.entity';

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
      loteServico: Number(lote.headerLote.loteServico.value),
      codigoConvenioBanco: asString(lote.headerLote.codigoConvenioBanco.value),
      numeroInscricao: asString(lote.headerLote.numeroInscricao.value),
      parametroTransmissao: asString(lote.headerLote.parametroTransmissao.value),
      tipoCompromisso: lote.headerLote.tipoCompromisso.value,
      tipoInscricao: lote.headerLote.tipoInscricao.value,
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
