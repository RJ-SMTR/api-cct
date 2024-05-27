import { Injectable, Logger } from '@nestjs/common';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, FindOneOptions, ILike, In } from 'typeorm';
import { DetalheADTO } from '../../dto/pagamento/detalhe-a.dto';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';
import { DetalheARepository } from '../../repository/pagamento/detalhe-a.repository';
import { ClienteFavorecidoService } from '../cliente-favorecido.service';
import { startOfDay } from 'date-fns';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { CnabHeaderArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabHeaderLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { TransacaoAgrupadoService } from './transacao-agrupado.service';
import { ItemTransacaoStatusEnum } from 'src/cnab/enums/pagamento/item-transacao-status.enum';
import { ItemTransacaoAgrupadoService } from './item-transacao-agrupado.service';
import { CnabLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface';

@Injectable()
export class DetalheAService {
  private logger: Logger = new Logger('DetalheAService', { timestamp: true });

  constructor(
    private detalheARepository: DetalheARepository,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private transacaoAgrupadoService: TransacaoAgrupadoService,
    private itemTransacaoAgrupadoService: ItemTransacaoAgrupadoService,
  ) {}

  /**
   * Assumimos que todos os detalheA do retorno têm dataVencimento na mesma semana.
   */
  async updateDetalheAStatus(lote: CnabLote104Pgto) {
    const dataVencimento = startOfDay(
      lote.registros[0].detalheA.dataVencimento.convertedValue,
    );
    const detalhesA = await this.detalheARepository.findMany({
      where: {
        dataVencimento: dataVencimento,
        nsr: In(lote.registros.map((i) => i.detalheA.nsr.convertedValue)),
        itemTransacaoAgrupado: {
          transacaoAgrupado: {
            status: { id: TransacaoStatusEnum.remessa },
          },
        },
      },
    });

    // Update Transacao status
    await this.transacaoAgrupadoService.updateMany(
      DetalheA.getTransacaoAgIds(detalhesA),
      {
        status: { id: TransacaoStatusEnum.retorno },
      },
    );
    await this.itemTransacaoAgrupadoService.updateMany(
      DetalheA.getItemTransacaoAgIds(detalhesA),
      {
        status: { id: ItemTransacaoStatusEnum.retorno },
      },
    );
  }

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
    headerArq: CnabHeaderArquivo104,
    headerLotePgto: CnabHeaderLote104Pgto,
    registro: CnabRegistros104Pgto,
    dataEfetivacao: Date,
  ): Promise<DetalheA | null> {
    const r = registro;
    const favorecido = await this.clienteFavorecidoService.findOne({
      where: { nome: ILike(`%${r.detalheA.nomeTerceiro.stringValue.trim()}%`) },
    });
    if (!favorecido) {
      return null;
    }
    const dataVencimento = startOfDay(
      registro.detalheA.dataVencimento.convertedValue,
    );
    const detalheARem = await this.detalheARepository.getOne({
      dataVencimento: dataVencimento,
      nsr: r.detalheA.nsr.convertedValue,
      itemTransacaoAgrupado: {
        transacaoAgrupado: {
          status: { id: TransacaoStatusEnum.remessa },
        },
      },
    });
    const detalheA = new DetalheADTO({
      id: detalheARem.id,
      headerLote: { id: detalheARem.headerLote.id },
      loteServico: Number(r.detalheA.loteServico.value),
      clienteFavorecido: { id: favorecido.id },
      finalidadeDOC: r.detalheA.finalidadeDOC.value,
      numeroDocumentoEmpresa: Number(r.detalheA.numeroDocumentoEmpresa.value),
      dataVencimento: startOfDay(r.detalheA.dataVencimento.convertedValue),
      dataEfetivacao: dataEfetivacao,
      tipoMoeda: r.detalheA.tipoMoeda.value,
      quantidadeMoeda: Number(r.detalheA.quantidadeMoeda.value),
      valorLancamento: r.detalheA.valorLancamento.convertedValue,
      numeroDocumentoBanco: String(
        r.detalheA.numeroDocumentoBanco.convertedValue,
      ),
      quantidadeParcelas: Number(r.detalheA.quantidadeParcelas.value),
      indicadorBloqueio: r.detalheA.indicadorBloqueio.value,
      indicadorFormaParcelamento:
        r.detalheA.indicadorFormaParcelamento.stringValue,
      periodoVencimento: startOfDay(r.detalheA.dataVencimento.convertedValue),
      numeroParcela: r.detalheA.numeroParcela.convertedValue,
      valorRealEfetivado: r.detalheA.valorRealEfetivado.convertedValue,
      nsr: Number(r.detalheA.nsr.value),
      ocorrenciasCnab:
        headerArq.ocorrenciaCobrancaSemPapel.value.trim() ||
        headerLotePgto.ocorrencias.value.trim() ||
        r.detalheA.ocorrencias.value.trim(),
    });
    const saved = await this.detalheARepository.save(detalheA);

    return saved;
  }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    await validateDTO(DetalheADTO, dto);
    return await this.detalheARepository.save(dto);
  }

  public async getOne(fields: EntityCondition<DetalheA>): Promise<DetalheA> {
    return await this.detalheARepository.getOne(fields);
  }

  public async findOne(
    options: FindOneOptions<DetalheA>,
  ): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne(options);
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
