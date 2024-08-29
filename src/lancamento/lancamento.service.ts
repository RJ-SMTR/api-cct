import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { endOfDay, isFriday, nextFriday, startOfDay, subDays } from 'date-fns';
import { ClienteFavorecidoService } from 'src/cnab/service/cliente-favorecido.service';
import { UsersService } from 'src/users/users.service';
import { CustomLogger } from 'src/utils/custom-logger';
import { CommonHttpException } from 'src/utils/http-exception/common-http-exception';
import { Between, IsNull, Like, Not } from 'typeorm';
import { AutorizaLancamentoDto } from './dtos/AutorizaLancamentoDto';
import { LancamentoInputDto } from './dtos/lancamento-input.dto';
import { Lancamento } from './lancamento.entity';
import { LancamentoRepository } from './lancamento.repository';

@Injectable()
export class LancamentoService {
  private readonly logger = new CustomLogger(LancamentoService.name, { timestamp: true });

  constructor(
    private readonly lancamentoRepository: LancamentoRepository, //
    private readonly usersService: UsersService,
    private readonly clienteFavorecidoService: ClienteFavorecidoService,
  ) {}

  // /**
  //  * Get unused data (no Transacao Id) from current payment week (thu-wed / qui-qua).
  //  */
  // async findByLancamentos(lancamentos: LancamentoEntity[]): Promise<LancamentoEntity[]> {
  //   const ids = lancamentos.map(i => i.id);
  //   const found = await this.lancamentoRepository.findMany({
  //     where: {
  //       id: In(ids)
  //     }
  //   });
  //   return found;
  // }

  /**
   * Get unused data (no Transacao Id) from current payment week (sex-qui).
   */
  async findToPayWeek(): Promise<Lancamento[]> {
    const today = new Date();
    const friday = isFriday(today) ? today : nextFriday(today);
    const sex = startOfDay(subDays(friday, 7));
    const qui = endOfDay(subDays(friday, 1));
    return await this.lancamentoRepository.findMany({
      where: {
        data_lancamento: Between(sex, qui),
        transacao: IsNull(),
        autorizado_por: Like('%,%'), // Ao menos 2 aprovados (1 vírgula)
      },
    });
  }

  async findByPeriod(args?: { mes?: number; periodo?: number; ano?: number; autorizado?: boolean }): Promise<Lancamento[]> {
    /** [startDate, endDate] */
    let dateRange: [Date, Date] | null = null;
    if (args?.mes && args?.periodo && args?.ano) {
      dateRange = this.getMonthDateRange(args.ano, args.mes, args.periodo);
    }

    const lancamentos = await this.lancamentoRepository.findMany({
      where: {
        ...(dateRange ? { data_lancamento: Between(...dateRange) } : {}),
        ...(args?.autorizado !== undefined ? (args.autorizado === true ? { autorizado_por: Like('%,%') } : { autorizado_por: Not(Like('%,%')) }) : {}),
      },
      relations: ['user'],
    });

    return lancamentos;
  }

  async findByStatus(status: boolean): Promise<Lancamento[]> {
    let lancamentos = await this.lancamentoRepository.findMany({
      where: {
        ...(status === true ? { autorizado_por: Like('%,%') } : { autorizado_por: Not(Like('%,%')) }),
      },
      relations: ['user'],
    });

    return lancamentos;
  }

  async getValorAutorizado(month: number, period: number, year: number) {
    const [startDate, endDate] = this.getMonthDateRange(year, month, period);

    const autorizados = await this.lancamentoRepository.findMany({
      where: {
        data_lancamento: Between(startDate, endDate),
        autorizado_por: Like('%,%'), // Ao menos 2 aprovados (1 vírgula)
      },
    });
    const autorizadoSum = autorizados.reduce((sum, lancamento) => sum + lancamento.valor, 0);
    const resp = {
      valor_autorizado: autorizadoSum,
    };
    return resp;
  }

  async create(dto: LancamentoInputDto): Promise<Lancamento> {
    const lancamento = await this.validateLancamentoDto(dto);
    const created = this.lancamentoRepository.create(lancamento);
    return await this.lancamentoRepository.save(created);
  }

  async validateLancamentoDto(dto: LancamentoInputDto): Promise<Lancamento> {
    const favorecido = await this.clienteFavorecidoService.findOne({ where: { id: dto.id_cliente_favorecido } });
    if (!favorecido) {
      throw CommonHttpException.message(`id_cliente_favorecido: Favorecido não encontrado no sistema`);
    }
    const lancamento = Lancamento.fromInputDto(dto);
    lancamento.clienteFavorecido = favorecido;
    return lancamento;
  }

  async autorizarPagamento(userId: number, lancamentoId: string, AutorizaLancamentoDto: AutorizaLancamentoDto): Promise<Lancamento> {
    const user = await this.usersService.findOne({ id: userId });
    if (!user) {
      throw new HttpException('Usuário não encontrado', HttpStatus.UNAUTHORIZED);
    }

    const isValidPassword = await bcrypt.compare(AutorizaLancamentoDto.password, user.password);
    if (!isValidPassword) {
      throw new HttpException('Senha inválida', HttpStatus.UNAUTHORIZED);
    }

    const lancamento = await this.lancamentoRepository.findOne({ where: { id: parseInt(lancamentoId) } });
    if (!lancamento) {
      throw new Error('Lançamento não encontrado.');
    }

    lancamento.pushAutorizado(userId);

    return await this.lancamentoRepository.save(lancamento);
  }

  async update(id: number, updateDto: LancamentoInputDto): Promise<Lancamento> {
    const lancamento = await this.lancamentoRepository.findOne({ where: { id } });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }

    const update = Lancamento.fromInputDto(updateDto);
    update.updateFromInputDto(updateDto);

    const updated = await this.lancamentoRepository.save(lancamento);
    this.logger.log(`Lancamento #${updated.id} atualizado por ${updated.clienteFavorecido.nome}.`);

    return lancamento;
  }

  async getById(id: number): Promise<Lancamento> {
    const lancamento = await this.lancamentoRepository.findOne({
      where: { id },
    });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }
    return lancamento;
  }

  async delete(id: number): Promise<void> {
    await this.lancamentoRepository.delete(id);
  }

  getMonthDateRange(year: number, month: number, period: number): [Date, Date] {
    let startDate: Date;
    let endDate: Date;

    if (period === 1) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month - 1, 15);
      endDate.setHours(23, 59, 59);
    } else if (period === 2) {
      startDate = new Date(year, month - 1, 16);
      endDate = new Date(year, month, 0);
      endDate.setHours(23, 59, 59);
    } else {
      throw new Error('Invalid period. Period should be 1 or 2.');
    }
    return [startDate, endDate];
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
