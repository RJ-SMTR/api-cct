import { Injectable, Logger } from '@nestjs/common';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { Between, DeepPartial, FindOneOptions, ILike, In } from 'typeorm';
import { DetalheADTO } from '../../dto/pagamento/detalhe-a.dto';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';
import { DetalheARepository } from '../../repository/pagamento/detalhe-a.repository';
import { ClienteFavorecidoService } from '../cliente-favorecido.service';
import { endOfDay, startOfDay } from 'date-fns';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { CnabHeaderArquivo104 } from 'src/cnab/interfaces/cnab-240/104/cnab-header-arquivo-104.interface';
import { CnabHeaderLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { TransacaoAgrupadoService } from './transacao-agrupado.service';
import { ItemTransacaoAgrupadoService } from './item-transacao-agrupado.service';
import { CnabLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-lote-104-pgto.interface';
import { CnabFile104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-file-104-pgto.interface';
import { Ocorrencia } from 'src/cnab/entity/pagamento/ocorrencia.entity';

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
   * Usamos HeaderArquivo.dataGeracao como parâmetro
   */
  async updateDetalheAStatus(cnab: CnabFile104Pgto) {
    const registros = cnab.lotes.reduce((l, i) => [...l, ...i.registros], []);
    const dataGeracao = cnab.headerArquivo.dataGeracaoArquivo.convertedValue;
    const detalhesA = await this.detalheARepository.findMany({
      where: {
        // no mesmo dia do CNAB (numDocEmpresa)
        headerLote: {
          headerArquivo: {
            dataGeracao: Between(
              startOfDay(dataGeracao),
              endOfDay(dataGeracao),
            ),
          },
        },
        // numDocEmpresa único por dia
        numeroDocumentoEmpresa: In(
          registros.map(
            (i) => i.detalheA.numeroDocumentoEmpresa.convertedValue,
          ),
        ),
        // Se não foi lido
        itemTransacaoAgrupado: {
          transacaoAgrupado: {
            status: { id: TransacaoStatusEnum.remessa },
          },
        },
      },
    });

    // Update Transacao status
    const transacaoAgIds = DetalheA.getTransacaoAgIds(detalhesA);
    await this.transacaoAgrupadoService.updateMany(
      transacaoAgIds,
      {
        status: { id: TransacaoStatusEnum.retorno },
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

  /**
   * @param headerArq Obter ocorrências
   * @param headerLotePgto Obter ocorrências
   * @param registro Atualizar DetalheA e ocorrêncisa
   * @param dataEfetivacao Definir data de efeticação
   */
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
    const dataGeracao = startOfDay(headerArq.dataGeracaoArquivo.convertedValue);
    const detalheARem = await this.detalheARepository.getOne({
      // Se é CNAB do mesmo dia (numDocEmpresa)
      headerLote: {
        headerArquivo: {
          dataGeracao: Between(startOfDay(dataGeracao), endOfDay(dataGeracao)),
        },
      },
      // numDocEmpresa único por dia
      numeroDocumentoEmpresa: r.detalheA.numeroDocumentoEmpresa.convertedValue,
      // Apenas CNABs que não leram retorno ainda
      itemTransacaoAgrupado: {
        transacaoAgrupado: {
          status: { id: TransacaoStatusEnum.remessa },
        },
      },
    });

    // Ocorrencias do DetalheA
    const ocorrenciaHeaderArq = headerArq.ocorrenciaCobrancaSemPapel.value.trim();
    const errorsHeaderArq = Ocorrencia.getErrorCodes(ocorrenciaHeaderArq);
    const ocorrenciaHeaderLote = headerLotePgto.ocorrencias.value.trim();
    const errorsHeaderLote = Ocorrencia.getErrorCodes(ocorrenciaHeaderLote);
    const ocorrenciaDetalheA = r.detalheA.ocorrencias.value.trim();
    let ocorrenciaDetalheAResult = ocorrenciaDetalheA;
    if (errorsHeaderArq.length > 0) {
      ocorrenciaDetalheAResult = ocorrenciaHeaderArq;
    }
    else if (errorsHeaderLote.length > 0) {
      ocorrenciaDetalheAResult = ocorrenciaHeaderLote;
    }

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
      ocorrenciasCnab: ocorrenciaDetalheAResult,
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
