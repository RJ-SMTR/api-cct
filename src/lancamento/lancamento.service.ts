import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { FavorecidoEmpresaCpfCnpjEnum, FavorecidoEmpresaNomeEnum } from 'src/cnab/enums/favorecido-empresa.enum';
import { ClienteFavorecidoService } from 'src/cnab/service/cliente-favorecido.service';
import { RoleEnum } from 'src/roles/roles.enum';
import { UsersService } from 'src/users/users.service';
import { compactQuery } from 'src/utils/console-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityHelper } from 'src/utils/entity-helper';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { asStringOrNumber } from 'src/utils/pipe-utils';
import { SqlDateOperator } from 'src/utils/sql/interfaces/sql-date-operator.interface';
import { DateMonth } from 'src/utils/types/date-month.type';
import { Between, DeepPartial, In, QueryRunner, UpdateResult } from 'typeorm';
import { LancamentoAuthorizeDto } from './dtos/lancamento-authorize.dto';
import { LancamentoDeleteDto } from './dtos/lancamento-delete.dto';
import { LancamentoUpsertDto } from './dtos/lancamento-upsert.dto';
import { Lancamento, TLancamento } from './entities/lancamento.entity';
import { LancamentoStatus } from './enums/lancamento-status.enum';
import { LancamentoAutorizacaoHistoryRepository } from './repositories/lancamento-autorizacao-history.repository';
import { LancamentoHistoryRepository } from './repositories/lancamento-history.repository';
import { LancamentoFindWhere, LancamentoRepository } from './repositories/lancamento.repository';
import { LancamentoAutorizacaoRepository } from './repositories/lancamento-autorizacao.repository';

/** Usado para exibição no erro */
const validFavorecidoNames = [
  String(FavorecidoEmpresaNomeEnum.CMTC), //
  String(FavorecidoEmpresaNomeEnum.Internorte),
  String(FavorecidoEmpresaNomeEnum.Intersul),
  String(FavorecidoEmpresaNomeEnum.SantaCruz),
  String(FavorecidoEmpresaNomeEnum.Transcarioca),
  String(FavorecidoEmpresaNomeEnum.VLT),
];
const validFavorecidoCpfCnpjs = [
  String(FavorecidoEmpresaCpfCnpjEnum.CMTC), //
  String(FavorecidoEmpresaCpfCnpjEnum.Internorte),
  String(FavorecidoEmpresaCpfCnpjEnum.Intersul),
  String(FavorecidoEmpresaCpfCnpjEnum.SantaCruz),
  String(FavorecidoEmpresaCpfCnpjEnum.Transcarioca),
  String(FavorecidoEmpresaCpfCnpjEnum.VLT),
];

@Injectable()
export class LancamentoService {
  private readonly logger = new CustomLogger(LancamentoService.name, { timestamp: true });

  constructor(
    private readonly lancamentoRepository: LancamentoRepository, //
    private readonly lancamentoAutorizacaoRepository: LancamentoAutorizacaoRepository, //
    private readonly lancamentoHistoryRepository: LancamentoHistoryRepository,
    private readonly lancamentoAutorizacaoHistoryRepository: LancamentoAutorizacaoHistoryRepository,
    private readonly usersService: UsersService,
    private readonly clienteFavorecidoService: ClienteFavorecidoService,
  ) {}

  /**
   * Procura itens não usados ainda (sem Transacao Id) from current payment week (sex-qui).
   */
  async findToPay(dataOrdemBetween?: [Date, Date]): Promise<{ cett: Lancamento[]; contaBilhetagem: Lancamento[] }> {
    const found = await this.lancamentoRepository.findMany({
      where: {
        ...(dataOrdemBetween ? { data_ordem: Between(...dataOrdemBetween) } : {}),
        status: LancamentoStatus._3_autorizado,
        is_autorizado: true,
      },
    });
    return {
      /** Usado para Lançamento Financeiro */
      cett: found.filter((l) => l.clienteFavorecido.cpfCnpj != String(FavorecidoEmpresaCpfCnpjEnum.VLT)),
      /** Usado majoritariamente para Jaé */
      contaBilhetagem: found.filter((l) => l.clienteFavorecido.cpfCnpj == String(FavorecidoEmpresaCpfCnpjEnum.VLT)),
    };
  }

  async find(args?: {
    data_lancamento?: {
      mes?: DateMonth; //
      periodo?: number;
      ano?: number;
    };
    autorizado?: boolean;
    pago?: boolean;
    detalheA?: { id: number[] };
    status?: LancamentoStatus;
    transacaoAgrupado?: { id: number };
  }): Promise<Lancamento[]> {
    const lancamentos = await this.lancamentoRepository.findMany(
      {
        where: {
          ...(args?.autorizado !== undefined ? { is_autorizado: args.autorizado } : {}),
          ...(args?.pago !== undefined ? { is_pago: args.pago } : {}),
          ...(args?.status ? { status: args.status } : {}),
        },
        relations: ['autorizacoes'] as (keyof TLancamento)[],
      },
      {
        ...(args?.detalheA ? { detalheA: args.detalheA } : {}),
        ...(args?.transacaoAgrupado ? { transacaoAgrupado: args.transacaoAgrupado } : {}),
        data_lancamento: this.getMonthDateRange({ year: args?.data_lancamento?.ano, month: args?.data_lancamento?.mes, period: args?.data_lancamento?.periodo }),
      },
    );

    return lancamentos;
  }

  async findByStatus(isAutorizado: boolean): Promise<Lancamento[]> {
    const lancamentos = await this.lancamentoRepository.findMany({ where: { is_autorizado: isAutorizado } });
    return lancamentos;
  }

  async getValorAutorizado(month?: DateMonth, period?: number, year?: number) {
    const data_lancamento = this.getMonthDateRange({ year, month, period });
    const autorizados = await this.lancamentoRepository.getValorAutoriado(data_lancamento);
    const resp = { valor_autorizado: autorizados };
    return resp;
  }

  async create(dto: LancamentoUpsertDto): Promise<Lancamento> {
    const lancamento = await this.validateCreate(dto);
    const created = await this.lancamentoRepository.save(this.lancamentoRepository.create(lancamento));
    const getCreated = await this.lancamentoRepository.getOne({ where: { id: created.id } });
    return getCreated;
  }

  async validateCreate(dto: LancamentoUpsertDto): Promise<Lancamento> {
    const favorecido = await this.clienteFavorecidoService.findOne({ where: { id: dto.id_cliente_favorecido } });
    if (!favorecido) {
      throw CommonHttpException.message(`id_cliente_favorecido: Favorecido não encontrado no sistema`);
    }
    if (!validFavorecidoCpfCnpjs.includes(favorecido.cpfCnpj)) {
      throw CommonHttpException.messageArgs(`id_cliente_favorecido: Favorecido não permitido para Lançamento.`, { validFavorecidos: validFavorecidoNames, found: { id: favorecido.id, name: favorecido.nome } });
    }
    const lancamento = Lancamento.fromInputDto(dto);
    lancamento.clienteFavorecido = new ClienteFavorecido({ id: favorecido.id });
    return lancamento;
  }

  async putAuthorize(userId: number, lancamentoId: number, autorizaLancamentoDto: LancamentoAuthorizeDto): Promise<Lancamento> {
    const lancamento = await this.validatePutAuthorize(userId, lancamentoId, autorizaLancamentoDto);
    // await this.createBackup(lancamento);
    lancamento.addAutorizacao(userId);
    await this.lancamentoRepository.save(lancamento);
    return await this.lancamentoRepository.getOne({ where: { id: lancamentoId } });
  }

  /**
   * Nota: Aqui não é validada a Role do usuário porque isto já é feito no controller.
   */
  async validatePutAuthorize(userId: number, lancamentoId: string | number, autorizaLancamentoDto: LancamentoAuthorizeDto) {
    const lancamento = await this.lancamentoRepository.findOne({ where: { id: asStringOrNumber(lancamentoId) } });
    if (!lancamento) {
      throw new HttpException('Lançamento não encontrado.', HttpStatus.NOT_FOUND);
    }

    const statusAprovador = [LancamentoStatus._1_gerado, LancamentoStatus._2_autorizado_parcial];
    if (!statusAprovador.includes(lancamento.status)) {
      throw new HttpException(`Apenas lançamentos com status ${statusAprovador.map((i) => `'${i}'`).join(', ')} podem ser aprovados. Status encontrado: '${lancamento.status}'.)`, HttpStatus.PRECONDITION_FAILED);
    }

    const user = await this.usersService.findOne({ id: userId });
    if (!user) {
      throw new HttpException('Usuário não encontrado', HttpStatus.UNAUTHORIZED);
    }

    if (lancamento.hasAutorizadoPor(user.id)) {
      throw new HttpException('Usuário já autorizou este Lançamento', HttpStatus.PRECONDITION_FAILED);
    }

    const isValidPassword = await bcrypt.compare(autorizaLancamentoDto.password, user.password);
    if (!isValidPassword) {
      throw new HttpException('Senha inválida', HttpStatus.UNAUTHORIZED);
    }
    return lancamento;
  }

  async updateDto(id: number, updateDto: LancamentoUpsertDto): Promise<Lancamento> {
    const lancamento = await this.validateUpdateDto(id, updateDto);
    await this.createBackup(lancamento);
    lancamento.updateFromDto(updateDto);
    await this.lancamentoRepository.save(lancamento);
    const updated = await this.lancamentoRepository.getOne({ where: { id: lancamento.id } });
    this.logger.log(`Lancamento #${updated.id} atualizado por ${updated.autor.getFullName()}.`);
    return updated;
  }

  /**
   * Nota: request.user.id = dto.author (autor da alteração atual)
   */
  async validateUpdateDto(id: number, updateDto: LancamentoUpsertDto): Promise<Lancamento> {
    const user = await this.usersService.getOne({ id: updateDto.author.id });
    const lancamento = await this.lancamentoRepository.findOne({ where: { id } });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }

    const statusLancador = [LancamentoStatus._1_gerado];
    if (user.role?.id === RoleEnum.lancador_financeiro && !statusLancador.includes(lancamento.status)) {
      throw new HttpException(`Lançador financeiro apenas pode editar Lançamentos com status ${statusLancador.map((i) => `'${i}'`).join(', ')}.`, HttpStatus.NOT_ACCEPTABLE);
    }

    const statusAprovador = [LancamentoStatus._1_gerado, LancamentoStatus._2_autorizado_parcial, LancamentoStatus._3_autorizado];
    if ((user.role?.id === RoleEnum.aprovador_financeiro || user.role?.id === RoleEnum.master) && !statusAprovador.includes(lancamento.status)) {
      throw new HttpException(`Aprovador financeiro apenas pode editar Lançamentos com status ${statusAprovador.map((i) => `'${i}'`).join(', ')}. Status encontrado: '${lancamento.status}'`, HttpStatus.NOT_ACCEPTABLE);
    }

    const favorecido = await this.clienteFavorecidoService.findOne({ where: { id: updateDto.id_cliente_favorecido } });
    if (!favorecido) {
      throw CommonHttpException.message('id_cliente_favorecido: Favorecido não encontrado no sistema');
    }
    if (lancamento.clienteFavorecido.id !== updateDto.id_cliente_favorecido) {
      throw CommonHttpException.messageArgs('id_cliente_favorecido: Não é permitido alterar o cliente favorecido de um Lançamento. ', { old: lancamento.clienteFavorecido.id, new: updateDto.id_cliente_favorecido });
    }
    if (!validFavorecidoCpfCnpjs.includes(favorecido.cpfCnpj)) {
      throw CommonHttpException.messageArgs('id_cliente_favorecido: Favorecido não permitido para Lançamento.', { validFavorecidos: validFavorecidoNames, found: { id: favorecido.id, name: favorecido.nome } });
    }
    return lancamento;
  }

  async updateManyRaw(dtos: DeepPartial<Lancamento>[], fields: (keyof TLancamento)[], queryRunner: QueryRunner): Promise<Lancamento[]> {
    if (!dtos.length) {
      return [];
    }
    const id: keyof TLancamento = 'id';
    const updatedAt: keyof TLancamento = 'updatedAt';
    const query = EntityHelper.getQueryUpdate('lancamento', dtos, fields, Lancamento.sqlFieldTypes, id, updatedAt);
    await queryRunner.manager.query(compactQuery(query));
    return dtos.map((dto) => new Lancamento(dto));
  }

  async getId(id: number): Promise<Lancamento> {
    const lancamento = await this.lancamentoRepository.findOne({ where: { id } });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }
    return lancamento;
  }

  async deleteId(userId: number, lancamentoId: number, lancamentoDeleteDto: LancamentoDeleteDto) {
    const lancamento = await this.validateDeleteId(userId, lancamentoId, lancamentoDeleteDto);
    await this.softDeleteAndBackup(lancamento, lancamentoDeleteDto);
  }

  async validateDeleteId(userId: number, lancamentoId: number, lancamentoDeleteDto: LancamentoDeleteDto) {
    const lancamento = await this.lancamentoRepository.findOne({ where: { id: lancamentoId } });
    if (!lancamento) {
      throw new HttpException('Lançamento não encontrado.', HttpStatus.NOT_FOUND);
    }

    const user = await this.usersService.findOne({ id: userId });
    if (!user) {
      throw new HttpException('Usuário não encontrado', HttpStatus.UNAUTHORIZED);
    }

    const lancamentoStatusLancador = [LancamentoStatus._1_gerado];
    if (user.role?.id === RoleEnum.lancador_financeiro && !lancamentoStatusLancador.includes(lancamento.status)) {
      throw new HttpException(`Lançador financeiro apenas pode deletar Lançamentos com status ${lancamentoStatusLancador.map((i) => `'${i}'`).join(', ')}.`, HttpStatus.NOT_ACCEPTABLE);
    }

    const lancamentoStatusAprovador = [LancamentoStatus._1_gerado, LancamentoStatus._2_autorizado_parcial, LancamentoStatus._3_autorizado];
    if ((user.role?.id === RoleEnum.aprovador_financeiro || user.role?.id === RoleEnum.master) && !lancamentoStatusAprovador.includes(lancamento.status)) {
      throw new HttpException(`Aprovador financeiro apenas pode deletar Lançamentos com status ${lancamentoStatusAprovador.map((i) => `'${i}'`).join(', ')}.`, HttpStatus.NOT_ACCEPTABLE);
    }

    const isValidPassword = await bcrypt.compare(lancamentoDeleteDto.password, user.password);
    if (!isValidPassword) {
      throw new HttpException('Senha inválida', HttpStatus.UNAUTHORIZED);
    }
    return lancamento;
  }

  getMonthDateRange(args?: { year?: number; month?: DateMonth; period?: number }): SqlDateOperator {
    return {
      ...(args?.year ? { year: args.year } : {}),
      ...(args?.month ? { month: args.month } : {}),
      ...(args?.period !== undefined ? { day: [args.period === 0 ? '<=' : '>', 15] } : {}),
    };
  }

  getDatePeriodInfo(date: Date) {
    const year = date.getFullYear();
    /** Os meses no JavaScript vão de 0 a 11, então é necessário adicionar 1 */
    const month = date.getMonth() + 1;
    const day = date.getDate();

    if (day <= 15) {
      return { year, month, period: 1 };
    } else {
      return { year, month, period: 2 };
    }
  }

  async update(set: DeepPartial<Lancamento>, where: LancamentoFindWhere): Promise<UpdateResult> {
    const lancamentoToUpdate = await this.lancamentoRepository.findMany(undefined, where);
    return await this.lancamentoRepository.update({ id: In(lancamentoToUpdate.map((l) => l.id)) }, set);
  }

  async updateAndBackup(set: DeepPartial<Lancamento>, where: LancamentoFindWhere): Promise<UpdateResult> {
    const lancamentoToUpdate = await this.lancamentoRepository.findMany(undefined, where);
    for (const lancamento of lancamentoToUpdate) {
      await this.createBackup(lancamento);
    }
    return await this.lancamentoRepository.update({ id: In(lancamentoToUpdate.map((l) => l.id)) }, set);
  }

  async softDeleteAndBackup(lancamento: Lancamento, deleteDto?: LancamentoDeleteDto) {
    await this.createBackup(lancamento);
    await this.lancamentoRepository.save({
      id: lancamento.id,
      status: LancamentoStatus._7_cancelado,
      motivo_cancelamento: deleteDto?.motivo_cancelamento || lancamento.motivo_cancelamento,
      autorizacoes: [],
    });
    await this.lancamentoRepository.softDelete(lancamento.id);
  }

  async createBackup(lancamento: Lancamento) {
    const history = await this.lancamentoHistoryRepository.createBackup(lancamento);
    await this.lancamentoAutorizacaoHistoryRepository.createBackup(history, lancamento);
  }
}
