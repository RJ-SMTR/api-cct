import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compactQuery } from 'src/utils/console-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { EntityCondition } from 'src/utils/types/entity-condition.type';
import { DeepPartial, FindManyOptions, FindOneOptions, InsertResult, Repository, UpdateResult } from 'typeorm';
import { SaveClienteFavorecidoDTO } from '../dto/cliente-favorecido.dto';
import { ClienteFavorecido } from '../entity/cliente-favorecido.entity';

export interface IClienteFavorecidoRawWhere {
  id?: number[];
  nome?: string[];
  cpfCnpj?: string;
  /** numeroDocumentoEmpresa */
  detalheANumeroDocumento?: number[];
  dataVencimento?: Date[];
  valorLancamento?: number[];
}

export interface IClienteFavorecidoFindBy {
  /** ILIKE unaccent */
  nome?: { in?: string[]; not?: string[] };
  consorcio?: string;
  cpfCnpj?: { not: string[] };
  limit?: number;
  page?: number;
}

@Injectable()
export class ClienteFavorecidoRepository {
  private logger = new CustomLogger(ClienteFavorecidoRepository.name, { timestamp: true });

  constructor(
    @InjectRepository(ClienteFavorecido)
    private clienteFavorecidoRepository: Repository<ClienteFavorecido>,
  ) {}

  createQueryBuilder = this.clienteFavorecidoRepository.createQueryBuilder;

  async remove(favorecidos: ClienteFavorecido[]) {
    return await this.clienteFavorecidoRepository.remove(favorecidos);
  }

  async save(dto: SaveClienteFavorecidoDTO): Promise<void> {
    if (dto.id === undefined) {
      await this.create(dto);
    } else {
      await this.update(dto.id, dto);
    }
  }

  public async findOneByNome(nome: string): Promise<ClienteFavorecido | null> {
    const cliente = await this.clienteFavorecidoRepository
      .createQueryBuilder('favorecido')
      .where('unaccent(UPPER("favorecido"."nome")) ILIKE unaccent(UPPER(:nome))', { nome: `%${nome}%` })
      .getOne();

    return cliente;
  }

  clear() {
    return this.clienteFavorecidoRepository.clear();
  }

  async create(createProfileDto: SaveClienteFavorecidoDTO): Promise<ClienteFavorecido> {
    const createdUser = await this.clienteFavorecidoRepository.save(this.clienteFavorecidoRepository.create(createProfileDto));
    this.logger.log(`ClienteFavorecido criado: ${createdUser.getLogInfo()}`);
    return createdUser;
  }

  async upsert(favorecidos: DeepPartial<ClienteFavorecido>[]): Promise<InsertResult> {
    const payload = await this.clienteFavorecidoRepository.upsert(favorecidos, {
      conflictPaths: { cpfCnpj: true },
      skipUpdateIfNoValuesChanged: true,
    });
    this.logger.log(`${payload.identifiers.length} ClienteFavorecidos atualizados.`);
    return payload;
  }

  async update(id: number, updateDto: SaveClienteFavorecidoDTO): Promise<UpdateResult> {
    const updatePayload = await this.clienteFavorecidoRepository.update({ id: id }, updateDto);
    const updatedItem = new ClienteFavorecido({
      id: id,
      ...updateDto,
    });
    this.logger.log(`ClienteFavorecido atualizado: ${updatedItem.getLogInfo()}`);
    return updatePayload;
  }

  public async getOne(fields: EntityCondition<ClienteFavorecido>): Promise<ClienteFavorecido> {
    const result = await this.clienteFavorecidoRepository.findOne({
      where: fields,
    });
    if (!result) {
      throw CommonHttpException.notFound(Object.entries(fields).join(','));
    } else return result;
  }

  public async findAll(): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.find();
  }
  public async findMany(options: FindManyOptions<ClienteFavorecido>): Promise<ClienteFavorecido[]> {
    return await this.clienteFavorecidoRepository.find(options);
  }

  public async findManyBy(where?: IClienteFavorecidoFindBy): Promise<ClienteFavorecido[]> {
    let isFirstWhere = false;
    let qb = this.clienteFavorecidoRepository.createQueryBuilder('favorecido');

    function cmd() {
      if (isFirstWhere) {
        isFirstWhere = false;
        return 'where';
      } else {
        return 'andWhere';
      }
    }

    if (where?.nome?.in?.length) {
      for (const nome of where.nome?.in) {
        qb = qb[cmd()]('favorecido."nome" ILIKE UNACCENT(UPPER(:nome))', {
          nome: `%${nome}%`,
        });
      }
    }
    if (where?.nome?.not?.length) {
      for (const nome of where.nome.not as string[]) {
        qb = qb[cmd()]('favorecido."nome" NOT ILIKE UNACCENT(UPPER(:nome))', {
          nome: `%${nome}%`,
        });
      }
    }

    if (where?.consorcio) {
      const consorcio = where.consorcio;
      if (consorcio === 'Van') {
        qb = qb[cmd()]('favorecido.tipo = :tipo', { tipo: 'vanzeiro' });
      } else if (consorcio === 'Empresa') {
        qb = qb[cmd()]('favorecido.tipo = :tipo', { tipo: 'consorcio' });
      }
    }
    if (where?.cpfCnpj?.not?.length) {
      qb = qb[cmd()](`favorecido."cpfCnpj" NOT IN (${where.cpfCnpj.not.map((i) => `'${i}'`).join(',')})`);
    }

    if (where?.limit && where?.page) {
      const skip = where?.limit * (where?.page - 1);
      qb = qb.take(where?.limit).skip(skip);
    }
    qb = qb.orderBy('"nome"', 'ASC');

    const result = await qb.getMany();
    return result;
  }

  public async findOne(options: FindOneOptions<ClienteFavorecido>): Promise<ClienteFavorecido | null> {
    const first = (await this.clienteFavorecidoRepository.find(options)).shift();
    return first || null;
  }

  public async findManyRaw(where: IClienteFavorecidoRawWhere): Promise<ClienteFavorecido[]> {
    let query = `
    SELECT cf.*
    FROM cliente_favorecido cf
    ${where.detalheANumeroDocumento || where.dataVencimento || where.valorLancamento
        ? `
    INNER JOIN item_transacao it ON it."clienteFavorecidoId" = cf.id
    INNER JOIN item_transacao_agrupado ita ON ita.id = it."itemTransacaoAgrupadoId"
    INNER JOIN detalhe_a da ON da."itemTransacaoAgrupadoId" = ita.id
        `
        : ''
      }
    WHERE 1=1
  `;

    if (where.id) {
      query += ` AND cf.id IN (${where.id.map((id) => `'${id}'`).join(',')})`;
    }

    if (where.cpfCnpj) {
      query += ` AND cf."cpfCnpj" = '${where.cpfCnpj}'`;
    }

    if (where.nome) {
      const trimmedNames = where.nome.map((n) => n.trim());
      const nomes = trimmedNames.map((n) => `'%${n}%'`);
      query += ` AND cf.nome ILIKE ANY(ARRAY[${nomes.join(',')}])`;

      const containsCorsorcio = trimmedNames.some(
        (name) => name.toLowerCase().includes('concessionaria') || name.toLowerCase().includes('consorcio')
      );
      if (containsCorsorcio && where.detalheANumeroDocumento) {
        query += ` AND da."numeroDocumentoEmpresa" IN (${where.detalheANumeroDocumento
          .map((doc) => `'${doc}'`)
          .join(',')})`;
      }
    }
    if (where.detalheANumeroDocumento) {
      query += ` AND da."numeroDocumentoEmpresa" IN (${where.detalheANumeroDocumento
        .map((doc) => `'${doc}'`)
        .join(',')})`;
    }

    if (where.dataVencimento) {
      const normalizedDates = where.dataVencimento.map((date) => {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          throw new Error(`Invalid date format: ${date}`);
        }
        return parsedDate.toISOString(); 
      });
      query += ` AND da."dataVencimento" = ANY(ARRAY[${normalizedDates
        .map((date) => `'${date}'`)
        .join(',')}]::timestamp[])`;
    }

    if (where.valorLancamento) {
      query += ` AND da."valorLancamento" IN (${where.valorLancamento
        .map((valor) => `${valor}`)
        .join(',')})`;
    }

    query += ` ORDER BY cf.id`;

    const result: any[] = await this.clienteFavorecidoRepository.query(compactQuery(query));
    
    return result.map((i) => new ClienteFavorecido(i));
  }


}
