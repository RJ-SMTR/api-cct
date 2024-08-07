import { PagamentosPendentes } from './../../entity/pagamento/pagamentos-pendentes.entity';
import { Injectable, Logger } from '@nestjs/common';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, FindOneOptions, ILike } from 'typeorm';
import { DetalheADTO } from '../../dto/pagamento/detalhe-a.dto';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';
import { DetalheARepository } from '../../repository/pagamento/detalhe-a.repository';
import { ClienteFavorecidoService } from '../cliente-favorecido.service';
import { startOfDay } from 'date-fns';
import { CnabHeaderArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabHeaderLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { TransacaoAgrupadoService } from './transacao-agrupado.service';
import { PagamentosPendentesService } from './pagamentos-pendentes.service';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { TransacaoStatus } from 'src/cnab/entity/pagamento/transacao-status.entity';

@Injectable()
export class DetalheAService {
  private logger: Logger = new Logger('DetalheAService', { timestamp: true });

  constructor(
    private detalheARepository: DetalheARepository,
    private clienteFavorecidoService: ClienteFavorecidoService,
    private transacaoAgrupadoService: TransacaoAgrupadoService,
    private pagamentosPendentesService: PagamentosPendentesService,
  ) {}

  /**
   * Assumimos que todos os detalheA do retorno têm dataVencimento na mesma semana.
   */
  async updateDetalheAStatus(detalheA: DetalheA) {
    // Update Transacao status
    const transacaoAgrupada = detalheA.itemTransacaoAgrupado.transacaoAgrupado;
    const status = new TransacaoStatus();
    status.id = TransacaoStatusEnum.publicado;
    transacaoAgrupada.status = status;
    await this.transacaoAgrupadoService.save(transacaoAgrupada);
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
    r: CnabRegistros104Pgto,
    dataEfetivacao: Date,
  ): Promise<DetalheA | null> {
    const favorecido = await this.clienteFavorecidoService.findOne({
      where: { nome: ILike(`%${r.detalheA.nomeTerceiro.stringValue.trim()}%`) },
    });

    if (!favorecido) {
      return null;
    }
    const dataVencimento = startOfDay(r.detalheA.dataVencimento.convertedValue);
    let detalheARem;
    try {
      detalheARem = await this.detalheARepository.getOne({
        dataVencimento: dataVencimento,
        numeroDocumentoEmpresa:
          r.detalheA.numeroDocumentoEmpresa.convertedValue,
        valorLancamento: r.detalheA.valorLancamento.convertedValue,
      });
      if (
        detalheARem.ocorrenciasCnab === undefined ||
        detalheARem.ocorrenciasCnab === '' ||
        (detalheARem.ocorrenciasCnab !== r.detalheA.ocorrencias.value.trim() &&
          detalheARem.ocorrenciasCnab !== '00' &&
          detalheARem.ocorrenciasCnab !== 'BD')
      ) {
        const detalheA = new DetalheADTO({
          id: detalheARem.id,
          // headerLote: { id: detalheARem.headerLote.id },
          loteServico: Number(r.detalheA.loteServico.value),
          finalidadeDOC: r.detalheA.finalidadeDOC.value,
          numeroDocumentoEmpresa: Number(
            r.detalheA.numeroDocumentoEmpresa.value,
          ),
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
          periodoVencimento: startOfDay(
            r.detalheA.dataVencimento.convertedValue,
          ),
          numeroParcela: r.detalheA.numeroParcela.convertedValue,
          valorRealEfetivado: r.detalheA.valorRealEfetivado.convertedValue,
          nsr: Number(r.detalheA.nsr.value),
          ocorrenciasCnab:
            r.detalheA.ocorrencias.value.trim() ||
            headerLotePgto.ocorrencias.value.trim() ||
            headerArq.ocorrenciaCobrancaSemPapel.value.trim(),
        });
        return await this.detalheARepository.save(detalheA);
      }
    } catch (err) {
      this.logger.error(err);
      this.logger.debug(
        `Detalhe não encontrado para o favorecido: `,
        favorecido?.nome,
      );
    }
    if (
      r.detalheA.ocorrencias !== undefined &&
      r.detalheA.ocorrencias.value.trim() !== '' &&
      r.detalheA.ocorrencias.value.trim() !== 'BD' &&
      r.detalheA.ocorrencias.value.trim() !== '00'
    ) {
      const pg = await this.pagamentosPendentesService.findOne({
        numeroDocumento: r.detalheA.numeroDocumentoEmpresa.value.trim(),
        valorLancamento: r.detalheA.valorLancamento.convertedValue,
        nomeFavorecido: r.detalheA.nomeTerceiro.convertedValue,
      });

      if (!pg) {
        const pagamentosPendentes = new PagamentosPendentes();
        pagamentosPendentes.nomeFavorecido =
          r.detalheA.nomeTerceiro.stringValue.trim();
        pagamentosPendentes.dataVencimento =
          r.detalheA.dataVencimento.convertedValue;
        pagamentosPendentes.valorLancamento =
          r.detalheA.valorLancamento.convertedValue;
        pagamentosPendentes.numeroDocumento =
          r.detalheA.numeroDocumentoEmpresa.value.trim();
        pagamentosPendentes.ocorrenciaErro =
          r.detalheA.ocorrencias.value.trim();
        await this.pagamentosPendentesService.save(pagamentosPendentes);
      }
    }
    return detalheARem;
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
