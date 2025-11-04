import { Injectable, Logger } from '@nestjs/common';
import { addDays, isDate, isThursday, nextFriday, startOfDay } from 'date-fns';
import { DeepPartial, FindManyOptions, QueryRunner } from 'typeorm';
import { ArquivoPublicacaoBigqueryDTO } from '../domain/dto/arquivo-publicacao-bigquery.dto';
import { ArquivoPublicacao } from '../domain/entity/arquivo-publicacao.entity';
import { DetalheA } from '../domain/entity/detalhe-a.entity';
import { ItemTransacao } from '../domain/entity/item-transacao.entity';
import { ArquivoPublicacaoRepository, IArquivoPublicacaoRawWhere } from '../repository/arquivo-publicacao.repository';
import { OcorrenciaService } from './ocorrencia.service';
import { ItemTransacaoService } from './item-transacao.service';
import { compactQuery } from 'src/utils/console-utils';
import { EntityHelper } from 'src/utils/entity-helper';

export type ArquivoPublicacaoFields = 'savePublicacaoRetorno';

@Injectable()
export class ArquivoPublicacaoService {
  private logger: Logger = new Logger('ArquivoPublicacaoService', {
    timestamp: true,
  });

  constructor(private arquivoPublicacaoRepository: ArquivoPublicacaoRepository, private transacaoOcorrenciaService: OcorrenciaService, private itemTransacaoService: ItemTransacaoService) {}

  public findMany(options: FindManyOptions<ArquivoPublicacao>) {
    return this.arquivoPublicacaoRepository.findMany(options);
  }

  public findManyRaw(where: IArquivoPublicacaoRawWhere) {
    return this.arquivoPublicacaoRepository.findManyRaw(where);
  }

  /**
   * @param startDate dataVencimento
   * @param endDate dataVencimento
   */
  public async findManyByDate(startDate: Date, endDate: Date, limit?: number, page?: number): Promise<ArquivoPublicacaoBigqueryDTO[]> {
    return await this.arquivoPublicacaoRepository.findManyByDate(startDate, endDate, limit, page);
  }

  /**
   * Generates a new ArquivoPublicacao from ItemTransacao
   *
   * **status** is Created.
   */
  async convertPublicacaoDTO(itemTransacao: ItemTransacao): Promise<ArquivoPublicacao> {
    const existing = await this.arquivoPublicacaoRepository.findOne({
      where: {
        itemTransacao: {
          id: itemTransacao.id,
        },
      },
    });
    const ordem = itemTransacao.dataOrdem;
    if (!isDate(ordem) || !ordem) {
      console.warn('erro');
    }

    /** Como é data relativa, se for quinta, pega a sexta da próxima semana */
    const friday = isThursday(ordem) ? addDays(ordem, 8) : nextFriday(ordem);

    const arquivo = new ArquivoPublicacao({
      ...(existing ? { id: existing.id } : {}),
      // Remessa
      itemTransacao: { id: itemTransacao.id },
      // Retorno
      isPago: false,
      dataGeracaoRetorno: null,
      dataVencimento: startOfDay(friday),
      dataEfetivacao: null,
      valorRealEfetivado: null,
    });
    return arquivo;
  }

  public async save(dto: DeepPartial<ArquivoPublicacao>, queryRunner: QueryRunner): Promise<ArquivoPublicacao> {
    return await queryRunner.manager.getRepository(ArquivoPublicacao).save(dto);
  }

  public async updateManyRaw(dtos: DeepPartial<ArquivoPublicacao>[], fields: ArquivoPublicacaoFields, queryRunner: QueryRunner): Promise<ArquivoPublicacao[]> {
    if (!dtos.length) {
      return [];
    }
    let fieldNames: (keyof ArquivoPublicacao)[] = [];
    if (fields == 'savePublicacaoRetorno') {
      fieldNames = ['id', 'isPago', 'valorRealEfetivado', 'dataEfetivacao', 'dataGeracaoRetorno'];
    }
    const fieldValues = dtos.map((dto) => `(${EntityHelper.getQueryFieldValues(dto, fieldNames, ArquivoPublicacao.sqlFieldTypes)})`).join(', ');
    // const reference: keyof IArquivoPublicacao = 'id';
    // const updatedAt: keyof IArquivoPublicacao = 'updatedAt';
    // const query = EntityHelper.getQueryUpdate('arquivo_publicacao', dtos, fieldNames, ArquivoPublicacao.sqlFieldTypes, reference, updatedAt);
    const query = `
    UPDATE arquivo_publicacao
    SET ${fieldNames.map((f) => `"${f}" = sub.${f == 'id' ? '_id' : `"${f}"`}`).join(', ')}, "updatedAt" = NOW()
    FROM (
        VALUES ${fieldValues}
    ) AS sub(${fieldNames.map((i) => (i == 'id' ? '_id' : `"${i}"`)).join(', ')})
    WHERE id = sub._id;
    `;
    await queryRunner.manager.query(compactQuery(query));
    return dtos.map((dto) => new ArquivoPublicacao(dto));
  }

  /**
   * Publicacao está associada com a ordem, portanto é sex-qui
   */
  async getPublicacoesWeek(detalheA: DetalheA) {
    const result = await this.findMany({
      where: {
        itemTransacao: {
          itemTransacaoAgrupado: { id: detalheA.itemTransacaoAgrupado.id },
        },
      },
    });
    return result;
  }

  async getOne(options: FindManyOptions<ArquivoPublicacao>) {
    return await this.arquivoPublicacaoRepository.getOne(options);
  }
}
