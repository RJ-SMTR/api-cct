import { Injectable } from '@nestjs/common';
import { TransacaoStatus } from 'src/cnab/entity/pagamento/transacao-status.entity';
import { TransacaoStatusEnum } from 'src/cnab/enums/pagamento/transacao-status.enum';
import { CnabHeaderLote104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-header-lote-104-pgto.interface';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { Nullable } from 'src/utils/types/nullable.type';
import { validateDTO } from 'src/utils/validation-utils';
import { DeepPartial, FindOneOptions } from 'typeorm';
import { DetalheADTO } from '../../dto/pagamento/detalhe-a.dto';
import { DetalheA } from '../../entity/pagamento/detalhe-a.entity';
import { DetalheARepository, IDetalheARawWhere } from '../../repository/pagamento/detalhe-a.repository';
import { ClienteFavorecidoService } from '../cliente-favorecido.service';
import { PagamentosPendentes } from './../../entity/pagamento/pagamentos-pendentes.entity';
import { PagamentosPendentesService } from './pagamentos-pendentes.service';
import { TransacaoAgrupadoService } from './transacao-agrupado.service';
import { CnabHeaderArquivo104 } from 'src/cnab/dto/cnab-240/104/cnab-header-arquivo-104.dto';

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
   * Salva DetalheA, PagamentosPendentes
   *
   * @returns: DetalheA ou motivoDoErro
   */
  public async saveRetornoFrom104(headerArq: CnabHeaderArquivo104, headerLotePgto: CnabHeaderLote104Pgto, r: CnabRegistros104Pgto, dataEfetivacao: Date, retornoName: string): Promise<DetalheA | ('favorecidoNotFound' | 'detalheANotFound' | 'hasUpdatedRetorno')> {
    const logRegistro = `HeaderArquivo: ${headerArq.nsa.convertedValue}, lote: ${headerLotePgto.codigoRegistro.value}`;
    const favorecido = await this.clienteFavorecidoService.findOneRaw({
      nome: [r.detalheA.nomeTerceiro.stringValue],
      // dataVencimento: [r.detalheA.dataVencimento.convertedValue],
      detalheANumeroDocumento: [r.detalheA.numeroDocumentoEmpresa.convertedValue],
      valorLancamento: [r.detalheA.valorLancamento.convertedValue]
    });


    if (!favorecido) {
      this.logger.warn(logRegistro + ` Detalhe A Documento: ${r.detalheA.numeroDocumentoEmpresa.convertedValue} - Favorecido não encontrado para o nome: '${r.detalheA.nomeTerceiro.stringValue.trim()}'`);
      return 'favorecidoNotFound';
    }

    const detalheA = await this.detalheARepository.findOneRaw({
      nome: [r.detalheA.nomeTerceiro.stringValue],
      // dataVencimento: [r.detalheA.dataVencimento.convertedValue],
      numeroDocumentoEmpresa: r.detalheA.numeroDocumentoEmpresa.convertedValue,
      valorLancamento: [r.detalheA.valorLancamento.convertedValue]
});
    
    if (!detalheA) {
      this.logger.warn(logRegistro + ` Detalhe A Documento: ${r.detalheA.numeroDocumentoEmpresa.convertedValue}, favorecido: '${favorecido.nome}' - NÃO ENCONTRADO!`);
      return 'detalheANotFound';
    } else if (!detalheA.hasOlderRetorno(retornoName)) {
      this.logger.log(logRegistro + ` Detalhe A Documento: ${r.detalheA.numeroDocumentoEmpresa.convertedValue}, favorecido: '${favorecido.nome}' - Já possui o retorno mais recente, nada a fazer. Atual: ${detalheA.retornoName}, novo: ${retornoName}`);
      return 'hasUpdatedRetorno';
    } else {
      if (detalheA.ocorrenciasCnab === undefined || detalheA.ocorrenciasCnab === '' || detalheA.ocorrenciasCnab !== r.detalheA.ocorrencias.value.trim() || !detalheA.dataEfetivacao) {
        const saveDetalheA = DetalheADTO.newRetornoPagamento(detalheA, headerArq, headerLotePgto, r, dataEfetivacao, retornoName);
        return await this.detalheARepository.save(saveDetalheA);
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
  }

  public async save(dto: DetalheADTO): Promise<DetalheA> {
    await validateDTO(DetalheADTO, dto);
    return await this.detalheARepository.save(dto);
  }

  public async getOneRaw(where: IDetalheARawWhere): Promise<DetalheA> {
    return await this.detalheARepository.getOneRaw(where);
  }

  public async getOne(fields: EntityCondition<DetalheA>): Promise<DetalheA> {
    return await this.detalheARepository.getOne(fields);
  }

  public async findOne(options: FindOneOptions<DetalheA>): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOne(options);
  }

  public async findOneRaw(where: IDetalheARawWhere): Promise<Nullable<DetalheA>> {
    return await this.detalheARepository.findOneRaw(where);
  }

  public async findMany(fields: EntityCondition<DetalheA>): Promise<DetalheA[]> {
    return await this.detalheARepository.findMany({ where: fields });
  }

  public async findManyRaw(where: IDetalheARawWhere): Promise<DetalheA[]> {
    return await this.detalheARepository.findRaw(where);
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
