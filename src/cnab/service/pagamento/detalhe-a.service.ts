import { PagamentosPendentes } from './../../entity/pagamento/pagamentos-pendentes.entity';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, FindManyOptions, FindOneOptions, ILike } from 'typeorm';
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
import { CustomLogger } from 'src/utils/custom-logger';

@Injectable()
export class DetalheAService {
  private logger = new CustomLogger('DetalheAService', { timestamp: true });

  constructor(private detalheARepository: DetalheARepository, private clienteFavorecidoService: ClienteFavorecidoService, private transacaoAgrupadoService: TransacaoAgrupadoService, private pagamentosPendentesService: PagamentosPendentesService) {}

  /**
   * Assumimos que todos os detalheA do retorno têm dataVencimento na mesma semana.
   */
  async updateDetalheAStatus(detalheA: DetalheA) {
    // Update Transacao status
    const transacaoAgrupada = detalheA.itemTransacaoAgrupado.transacaoAgrupado;
    const status = TransacaoStatus.fromEnum(TransacaoStatusEnum.publicado);
    transacaoAgrupada.status = status;
    await this.transacaoAgrupadoService.save(transacaoAgrupada);
  }

  /**
   * Any DTO existing in db will be ignored.
   *
   * @param dtos DTOs that can exist or not in database
   * @returns Saved objects not in database.
   */
  public saveManyIfNotExists(dtos: DeepPartial<DetalheA>[]): Promise<DetalheA[]> {
    return this.detalheARepository.saveManyIfNotExists(dtos);
  }

  /**
   * Salva DetalheA, PagamentosPendentes
   */
  public async saveRetornoFrom104(headerArq: CnabHeaderArquivo104, headerLotePgto: CnabHeaderLote104Pgto, r: CnabRegistros104Pgto, dataEfetivacao: Date): Promise<DetalheA | null> {
    const logRegistro = `HeaderArquivo: ${headerArq.nsa.convertedValue}, lote: ${headerLotePgto.codigoRegistro.value}`;
    const favorecido = await this.clienteFavorecidoService.findOneRaw({
      detalheANumeroDocumento: [r.detalheA.numeroDocumentoEmpresa.convertedValue],
    });

    if (!favorecido) {
      this.logger.warn(logRegistro + ` Detalhe A Documento: ${r.detalheA.numeroDocumentoEmpresa.convertedValue} - Favorecido não encontrado para o nome: '${r.detalheA.nomeTerceiro.stringValue.trim()}'`);
      return null;
    }
    const detalheA = await this.detalheARepository.findOneRaw({
      numeroDocumentoEmpresa: r.detalheA.numeroDocumentoEmpresa.convertedValue,
    });
    if (detalheA) {
      if (detalheA.ocorrenciasCnab === undefined || detalheA.ocorrenciasCnab === '' || detalheA.ocorrenciasCnab !== r.detalheA.ocorrencias.value.trim() || !detalheA.dataEfetivacao) {
        const saveDetalheA = new DetalheADTO({
          id: detalheA.id,
          loteServico: Number(r.detalheA.loteServico.value),
          finalidadeDOC: r.detalheA.finalidadeDOC.value,
          numeroDocumentoEmpresa: Number(r.detalheA.numeroDocumentoEmpresa.value),
          dataVencimento: startOfDay(r.detalheA.dataVencimento.convertedValue),
          dataEfetivacao: dataEfetivacao,
          tipoMoeda: r.detalheA.tipoMoeda.value,
          quantidadeMoeda: Number(r.detalheA.quantidadeMoeda.value),
          valorLancamento: r.detalheA.valorLancamento.convertedValue,
          numeroDocumentoBanco: String(r.detalheA.numeroDocumentoBanco.convertedValue),
          quantidadeParcelas: Number(r.detalheA.quantidadeParcelas.value),
          indicadorBloqueio: r.detalheA.indicadorBloqueio.value,
          indicadorFormaParcelamento: r.detalheA.indicadorFormaParcelamento.stringValue,
          periodoVencimento: startOfDay(r.detalheA.dataVencimento.convertedValue),
          numeroParcela: r.detalheA.numeroParcela.convertedValue,
          valorRealEfetivado: r.detalheA.valorRealEfetivado.convertedValue,
          nsr: Number(r.detalheA.nsr.value),
          ocorrenciasCnab: r.detalheA.ocorrencias.value.trim() || headerLotePgto.ocorrencias.value.trim() || headerArq.ocorrenciaCobrancaSemPapel.value.trim(),
        });
        return await this.detalheARepository.save(saveDetalheA);
      }
    } else {
      this.logger.warn(logRegistro + ` Detalhe A Documento: ${r.detalheA.numeroDocumentoEmpresa.convertedValue}, favorecido: '${favorecido.nome}' - NÃO ENCONTRADO!`);
    }
    if (r.detalheA.ocorrencias !== undefined && r.detalheA.ocorrencias.value.trim() !== '' && r.detalheA.ocorrencias.value.trim() !== 'BD' && r.detalheA.ocorrencias.value.trim() !== '00') {
      const pg = await this.pagamentosPendentesService.findOne({
        numeroDocumento: r.detalheA.numeroDocumentoEmpresa.value.trim(),
        valorLancamento: r.detalheA.valorLancamento.convertedValue,
        nomeFavorecido: r.detalheA.nomeTerceiro.convertedValue,
      });

      if (!pg) {
        const pagamentosPendentes = new PagamentosPendentes();
        pagamentosPendentes.nomeFavorecido = r.detalheA.nomeTerceiro.stringValue.trim();
        pagamentosPendentes.dataVencimento = r.detalheA.dataVencimento.convertedValue;
        pagamentosPendentes.valorLancamento = r.detalheA.valorLancamento.convertedValue;
        pagamentosPendentes.numeroDocumento = r.detalheA.numeroDocumentoEmpresa.value.trim();
        pagamentosPendentes.ocorrenciaErro = r.detalheA.ocorrencias.value.trim();
        await this.pagamentosPendentesService.save(pagamentosPendentes);
      }
    }
    return detalheA;
  }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    await validateDTO(DetalheADTO, dto);
    return await this.detalheARepository.save(dto);
  }

  public async getOne(fields: EntityCondition<DetalheA>): Promise<DetalheA> {
    return await this.detalheARepository.getOne(fields);
  }

  public async findOne(options: FindOneOptions<DetalheA>): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne(options);
  }

  public async findMany(fields: EntityCondition<DetalheA>): Promise<DetalheA[]> {
    return await this.detalheARepository.findMany({ where: fields });
  }

  public async findManyRaw(options: FindManyOptions<DetalheA>): Promise<DetalheA[]> {
    return await this.detalheARepository.findMany(options);
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
