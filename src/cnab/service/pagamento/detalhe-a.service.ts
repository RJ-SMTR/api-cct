import { Injectable, Logger } from '@nestjs/common';
import { HeaderLote } from 'src/cnab/entity/pagamento/header-lote.entity';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { SaveIfNotExists } from 'src/utils/types/save-if-not-exists.type';
import { validateDTO } from 'src/utils/validation-utils';
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
  ) { }

  public async saveFrom104(registro: CnabRegistros104Pgto, headerLote: HeaderLote
  ): Promise<SaveIfNotExists<DetalheA>> {
    const r = registro;
    const favorecido =
      await this.clienteFavorecidoService.getOne({
        contaCorrente: r.detalheA.contaCorrenteDestino.value,
        dvContaCorrente: r.detalheA.dvContaDestino.value
      });

    const detalheA = new DetalheADTO({
      headerLote: { id: headerLote.id },
      loteServico: r.detalheA.loteServico.format.value,
      clienteFavorecido: { id: favorecido.id },
      finalidadeDOC: r.detalheA.finalidadeDOC.value,
      numeroDocumentoEmpresa: r.detalheA.numeroDocumentoEmpresa.format.value,
      dataVencimento: r.detalheA.dataVencimento.format.value,
      tipoMoeda: r.detalheA.tipoMoeda.value,
      quantidadeMoeda: r.detalheA.quantidadeMoeda.format.value,
      valorLancamento: r.detalheA.valorLancamento.format.value,
      numeroDocumentoBanco: r.detalheA.numeroDocumentoBanco.value,
      quantidadeParcelas: r.detalheA.quantidadeParcelas.format.value,
      indicadorBloqueio: r.detalheA.indicadorBloqueio.value,
      indicadorFormaParcelamento: r.detalheA.indicadorFormaParcelamento.value,
      periodoVencimento: r.detalheA.dataVencimento.format.value,
      numeroParcela: r.detalheA.numeroParcela.format.value,
      dataEfetivacao: r.detalheA.dataEfetivacao.format.value,
      valorRealEfetivado: r.detalheA.valorRealEfetivado.format.value,
      nsr: r.detalheA.nsr.format.value,
      ocorrencias: r.detalheA.ocorrencias.value,
    });
    return await this.detalheARepository.saveIfNotExists(detalheA);
  }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    await validateDTO(DetalheADTO, dto);
    return await this.detalheARepository.save(dto);
  }

  public async findOne(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne(fields);
  }

  public async findMany(
    fields: EntityCondition<DetalheA> | EntityCondition<DetalheA>[],
  ): Promise<DetalheA[]> {
    return await this.detalheARepository.findMany(fields);
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
