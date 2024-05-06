import { Injectable, Logger } from '@nestjs/common';
import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial } from 'typeorm';
import { DetalheADTO } from '../../dto/pagamento/detalhe-a.dto';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';
import { DetalheARepository } from '../../repository/pagamento/detalhe-a.repository';
import { ClienteFavorecidoService } from '../cliente-favorecido.service';

@Injectable()
export class DetalheAService {
  private logger: Logger = new Logger('DetalheAService', { timestamp: true });

  constructor(
    private detalheARepository: DetalheARepository,
    private clienteFavorecidoService: ClienteFavorecidoService,
  ) {}

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public saveManyIfNotExists(
    dtos: DeepPartial<DetalheA>[],
  ): Promise<DetalheA[]> {
    return this.detalheARepository.saveManyIfNotExists(dtos);
  }

  public async saveFrom104(
    registro: CnabRegistros104Pgto,
    headerLote: HeaderLote,
  ): Promise<SaveIfNotExists<DetalheA>> {
    const r = registro;
    const favorecido = await this.clienteFavorecidoService.getOne({
      contaCorrente: r.detalheA.contaCorrenteDestino.stringValue,
      dvContaCorrente: r.detalheA.dvContaDestino.value,
    });

    const detalheA = new DetalheADTO({
      headerLote: { id: headerLote.id },
      loteServico: r.detalheA.loteServico.convertedValue,
      clienteFavorecido: { id: favorecido.id },
      finalidadeDOC: r.detalheA.finalidadeDOC.stringValue,
      numeroDocumentoEmpresa: r.detalheA.numeroDocumentoEmpresa.convertedValue,
      dataVencimento: r.detalheA.dataVencimento.convertedValue,
      tipoMoeda: r.detalheA.tipoMoeda.stringValue,
      quantidadeMoeda: r.detalheA.quantidadeMoeda.convertedValue,
      valorLancamento: r.detalheA.valorLancamento.convertedValue,
      numeroDocumentoBanco: r.detalheA.numeroDocumentoBanco.stringValue,
      quantidadeParcelas: r.detalheA.quantidadeParcelas.convertedValue,
      indicadorBloqueio: r.detalheA.indicadorBloqueio.stringValue,
      indicadorFormaParcelamento:
        r.detalheA.indicadorFormaParcelamento.stringValue,
      periodoVencimento: r.detalheA.dataVencimento.convertedValue,
      numeroParcela: r.detalheA.numeroParcela.convertedValue,
      dataEfetivacao: r.detalheA.dataEfetivacao.convertedValue,
      valorRealEfetivado: r.detalheA.valorRealEfetivado.convertedValue,
      nsr: r.detalheA.nsr.convertedValue,
      ocorrenciasCnab: r.detalheA.ocorrencias.stringValue,
    });
    return await this.detalheARepository.saveIfNotExists(detalheA);
  }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    await validateDTO(DetalheADTO, dto);
    return await this.detalheARepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheA>,
  ): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<DetalheA>,
  ): Promise<DetalheA[]> {
    return await this.detalheARepository.findMany({ where: fields });
  }

  /**
   * numeroDocumento:
   *
   * - Começa com 000001
   * - Soma 1 para cada registro no arquivo
   * - Reinicia para 1 para cada data de pagamento
   *
   * Usado nos Dertalhes: A, J, O, N
   *
   * @example
   * 01/01/2024
   * - Cnab1
   *    - DetalheA = 1
   *    - DetalheA = 2
   * - Cnab2
   *    - DetalheA = 3
   *    - DetalheA = 4
   *
   * 02/01/2024
   * - Cnab1
   *    - DetalheA = 1
   *    - DetalheA = 2
   * - Cnab2
   *    - DetalheA = 3
   *    - DetalheA = 4
   *
   */
  public async getNextNumeroDocumento(date: Date): Promise<number> {
    return await this.detalheARepository.getNextNumeroDocumento(date);
  }
}
