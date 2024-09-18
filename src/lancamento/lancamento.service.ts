import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { FavorecidoEmpresaCpfCnpjEnum, FavorecidoEmpresaNomeEnum } from 'src/cnab/enums/favorecido-empresa.enum';
import { ClienteFavorecidoService } from 'src/cnab/service/cliente-favorecido.service';
import { UsersService } from 'src/users/users.service';
import { compactQuery } from 'src/utils/console-utils';
import { CustomLogger } from 'src/utils/custom-logger';
import { EntityHelper } from 'src/utils/entity-helper';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { SqlDateOperator } from 'src/utils/sql/interfaces/sql-date-operator.interface';
import { Between, DeepPartial, QueryRunner, UpdateResult } from 'typeorm';
import { AutorizaLancamentoDto } from './dtos/AutorizaLancamentoDto';
import { LancamentoInputDto } from './dtos/lancamento-input.dto';
import { ILancamento, Lancamento } from './entities/lancamento.entity';
import { LancamentoStatus } from './enums/lancamento-status.enum';
import { LancamentoRepository, LancamentoUpdateWhere } from './lancamento.repository';
import { DateMonth } from 'src/utils/types/date-month.type';

/** Usado para exibição no erro */
const validFavorecidoNames = [
  String(FavorecidoEmpresaNomeEnum.CMTC), //
  String(FavorecidoEmpresaNomeEnum.Internorte),
  String(FavorecidoEmpresaNomeEnum.Intersul),
  String(FavorecidoEmpresaNomeEnum.SantaCruz),
  String(FavorecidoEmpresaNomeEnum.Transcarioca),
  // ConcessionariaNomeEnum.VLT, // DESABILITADO ATÉ O MOMENTO
];
const validFavorecidoCpfCnpjs = [
  String(FavorecidoEmpresaCpfCnpjEnum.CMTC), //
  String(FavorecidoEmpresaCpfCnpjEnum.Internorte),
  String(FavorecidoEmpresaCpfCnpjEnum.Intersul),
  String(FavorecidoEmpresaCpfCnpjEnum.SantaCruz),
  String(FavorecidoEmpresaCpfCnpjEnum.Transcarioca),
  // ConcessionariaNomeEnum.VLT, // DESABILITADO ATÉ O MOMENTO
];

@Injectable()
export class LancamentoService {
  private readonly logger = new CustomLogger(LancamentoService.name, { timestamp: true });

  constructor(
    private readonly lancamentoRepository: LancamentoRepository, //
    private readonly usersService: UsersService,
    private readonly clienteFavorecidoService: ClienteFavorecidoService,
  ) {}

  /**
   * Procura itens não usados ainda (sem Transacao Id) from current payment week (sex-qui).
   */
  async findToPay(dataOrdemBetween?: [Date, Date]) {
    const found = await this.lancamentoRepository.findMany({
      where: {
        ...(dataOrdemBetween ? { data_ordem: Between(...dataOrdemBetween) } : {}),
        status: LancamentoStatus._2_autorizado,
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
  }): Promise<Lancamento[]> {
    const lancamentos = await this.lancamentoRepository.findMany(
      {
        where: {
          ...(args?.autorizado !== undefined ? { is_autorizado: args.autorizado } : {}),
          ...(args?.pago !== undefined ? { is_pago: args.pago } : {}),
          ...(args?.status ? { status: args.status } : {}),
        },
        relations: ['autorizacoes'] as (keyof ILancamento)[],
      },
      {
        ...(args?.detalheA ? { detalheA: args.detalheA } : {}),
        data_lancamento: this.getMonthDateRange({ year: args?.data_lancamento?.ano, month: args?.data_lancamento?.mes, period: args?.data_lancamento?.periodo }),
      },
    );

    return lancamentos;
  }

  async findByStatus(isAutorizado: boolean): Promise<Lancamento[]> {
    const lancamentos = await this.lancamentoRepository.findMany({ where: { is_autorizado: isAutorizado } });
    return lancamentos;
  }

  async getValorAutorizado(month: DateMonth, period: number, year: number) {
    const data_lancamento = this.getMonthDateRange({ year, month, period });
    const autorizados = await this.lancamentoRepository.findMany(undefined, { data_lancamento });
    const autorizadoSum = autorizados.reduce((sum, lancamento) => sum + lancamento.valor, 0);
    const resp = { valor_autorizado: autorizadoSum };
    return resp;
  }

  async create(dto: LancamentoInputDto): Promise<Lancamento> {
    const lancamento = await this.validateCreate(dto);
    const created = await this.lancamentoRepository.save(this.lancamentoRepository.create(lancamento));
    const getCreated = await this.lancamentoRepository.getOne({ where: { id: created.id } });
    return getCreated;
  }

  async validateCreate(dto: LancamentoInputDto): Promise<Lancamento> {
    const favorecido = await this.clienteFavorecidoService.findOne({ where: { id: dto.id_cliente_favorecido } });
    if (!favorecido) {
      throw CommonHttpException.message(`id_cliente_favorecido: Favorecido não encontrado no sistema`);
    }
    if (!validFavorecidoCpfCnpjs.includes(favorecido.cpfCnpj)) {
      throw CommonHttpException.messageArgs(`id_cliente_favorecido: Favorecido não permitido para Lançamento.`, { validFavorecidos: validFavorecidoNames });
    }
    const lancamento = Lancamento.fromInputDto(dto);
    lancamento.clienteFavorecido = new ClienteFavorecido({ id: favorecido.id });
    return lancamento;
  }

  async autorizarPagamento(userId: number, lancamentoId: string, AutorizaLancamentoDto: AutorizaLancamentoDto): Promise<Lancamento> {
    const lancamento = await this.lancamentoRepository.findOne({ where: { id: parseInt(lancamentoId) } });
    if (!lancamento) {
      throw new HttpException('Lançamento não encontrado.', HttpStatus.NOT_FOUND);
    }

    if (lancamento.status !== LancamentoStatus._1_criado) {
      throw new HttpException(`Apenas lançamentos com status '${LancamentoStatus._1_criado}' podem ser aprovados. Status encontrado: '${lancamento.status}'.)`, HttpStatus.PRECONDITION_FAILED);
    }

    const user = await this.usersService.findOne({ id: userId });
    if (!user) {
      throw new HttpException('Usuário não encontrado', HttpStatus.UNAUTHORIZED);
    }

    if (lancamento.hasAutorizadoPor(user.id)) {
      throw new HttpException('Usuário já autorizou este Lançamento', HttpStatus.PRECONDITION_FAILED);
    }

    const isValidPassword = await bcrypt.compare(AutorizaLancamentoDto.password, user.password);
    if (!isValidPassword) {
      throw new HttpException('Senha inválida', HttpStatus.UNAUTHORIZED);
    }

    lancamento.addAutorizado(userId);

    return await this.lancamentoRepository.save(lancamento);
  }

  updateRaw(set: DeepPartial<Lancamento>, where: LancamentoUpdateWhere): Promise<UpdateResult> {
    return this.lancamentoRepository.updateRaw(set, where);
  }

  async updateDto(id: number, updateDto: LancamentoInputDto): Promise<Lancamento> {
    const lancamento = await this.validateUpdateDto(id, updateDto);
    lancamento.updateFromInputDto(updateDto);
    await this.lancamentoRepository.save(lancamento);
    const updated = await this.lancamentoRepository.getOne({ where: { id: lancamento.id } });
    this.logger.log(`Lancamento #${updated.id} atualizado por ${updated.clienteFavorecido.nome}.`);
    return updated;
  }

  async validateUpdateDto(id: number, updateDto: LancamentoInputDto): Promise<Lancamento> {
    const lancamento = await this.lancamentoRepository.findOne({ where: { id } });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }
    if (lancamento.status !== LancamentoStatus._1_criado) {
      throw new HttpException('Apenas é permitido alterar Lançamentos com status criado.', HttpStatus.NOT_ACCEPTABLE);
    }
    const favorecido = await this.clienteFavorecidoService.findOne({ where: { id: updateDto.id_cliente_favorecido } });
    if (!favorecido) {
      throw CommonHttpException.message('id_cliente_favorecido: Favorecido não encontrado no sistema');
    }
    if (!validFavorecidoNames.includes(favorecido.nome)) {
      throw CommonHttpException.messageArgs('id_cliente_favorecido: Favorecido não permitido para Lançamento.', { validFavorecidos: validFavorecidoNames });
    }
    if (lancamento.clienteFavorecido.id !== updateDto.id_cliente_favorecido) {
      throw CommonHttpException.messageArgs('id_cliente_favorecido: Não é permitido alterar o cliente favorecido de um Lançamento. ', { old: lancamento.clienteFavorecido.id, new: updateDto.id_cliente_favorecido });
    }
    return lancamento;
  }

  async updateManyRaw(dtos: DeepPartial<Lancamento>[], fields: (keyof ILancamento)[], queryRunner: QueryRunner): Promise<Lancamento[]> {
    if (!dtos.length) {
      return [];
    }
    const id: keyof ILancamento = 'id';
    const updatedAt: keyof ILancamento = 'updatedAt';
    const query = EntityHelper.getQueryUpdate('lancamento', dtos, fields, Lancamento.sqlFieldTypes, id, updatedAt);
    await queryRunner.manager.query(compactQuery(query));
    return dtos.map((dto) => new Lancamento(dto));
  }

  async getById(id: number): Promise<Lancamento> {
    const lancamento = await this.lancamentoRepository.findOne({ where: { id } });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }
    return lancamento;
  }

  async deleteId(id: number): Promise<void> {
    const toDelete = await this.lancamentoRepository.findOne({ where: { id } });
    if (!toDelete) {
      throw new HttpException('Lançamento a ser deletado não existe.', HttpStatus.NOT_FOUND);
    }
    if ([LancamentoStatus._1_criado, LancamentoStatus._2_autorizado].includes(toDelete.status)) {
      throw new HttpException('Apenas é permitido deletar Lançamentos com status criado ou aprovado.', HttpStatus.NOT_ACCEPTABLE);
    }
    await this.lancamentoRepository.softDelete(id);
  }

  getMonthDateRange(args?: { year?: number; month?: DateMonth; period?: number }): SqlDateOperator {
    return {
      ...(args?.year ? { year: args.year } : {}),
      ...(args?.month ? { month: args.month } : {}),
      ...(args?.period ? { day: [args.period === 1 ? '<=' : '>', 15] } : {}),
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
}
