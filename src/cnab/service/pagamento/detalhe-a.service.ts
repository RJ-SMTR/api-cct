import { Injectable, Logger } from '@nestjs/common';
import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, ILike } from 'typeorm';
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

  public async saveRetornoFrom104(
    registro: CnabRegistros104Pgto,
    headerLoteUpdated: HeaderLote,
  ): Promise<DetalheA | null> {
    const r = registro;
    const favorecido = await this.clienteFavorecidoService.findOne({
      where: { nome: ILike(`%${r.detalheA.nomeTerceiro.stringValue.trim()}%`) },
    });
    if (!favorecido) {
      return null;
    }
    const detalheARem = await this.detalheARepository.getOne({
      headerLote: { id: headerLoteUpdated.id },
      nsr: r.detalheA.nsr.convertedValue,
    });
    const detalheA = new DetalheADTO({
      id: detalheARem?.id,
      headerLote: { id: headerLoteUpdated.id },
      loteServico: Number(r.detalheA.loteServico.value),
      clienteFavorecido: { id: favorecido.id },
      finalidadeDOC: r.detalheA.finalidadeDOC.value,
      numeroDocumentoEmpresa: Number(r.detalheA.numeroDocumentoEmpresa.value),
      dataVencimento: r.detalheA.dataVencimento.convertedValue,
      tipoMoeda: r.detalheA.tipoMoeda.value,
      quantidadeMoeda: Number(r.detalheA.quantidadeMoeda.value),
      valorLancamento: r.detalheA.valorLancamento.convertedValue,
      numeroDocumentoBanco: String(r.detalheA.numeroDocumentoBanco.convertedValue),
      quantidadeParcelas: Number(r.detalheA.quantidadeParcelas.value),
      indicadorBloqueio: r.detalheA.indicadorBloqueio.value,
      indicadorFormaParcelamento:
        r.detalheA.indicadorFormaParcelamento.stringValue,
      periodoVencimento: r.detalheA.dataVencimento.convertedValue,
      numeroParcela: r.detalheA.numeroParcela.convertedValue,
      dataEfetivacao: r.detalheA.dataEfetivacao.convertedValue,
      valorRealEfetivado: r.detalheA.valorRealEfetivado.convertedValue,
      nsr: Number(r.detalheA.nsr.value),
      ocorrenciasCnab: r.detalheA.ocorrencias.value,
    });
    return await this.detalheARepository.save(detalheA);
  }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    await validateDTO(DetalheADTO, dto);
    return await this.detalheARepository.save(dto);
  }

  public async getOne(
    fields: EntityCondition<DetalheA>,
  ): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.getOne(fields);
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
