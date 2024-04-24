import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItfLancamento } from './interfaces/lancamento.interface';
import { LancamentoEntity } from './lancamento.entity';
import { Between } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { In } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { AutorizaLancamentoDto } from './AutorizaLancamentoDto';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class LancamentoService {
  constructor(
    @InjectRepository(LancamentoEntity)
    private readonly lancamentoRepository: Repository<LancamentoEntity>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly usersService: UsersService,
  ) { }

  async findByPeriod(
    month: number,
    period: number,
    year: number,
    authorized: number | null = null,
  ): Promise<ItfLancamento[]> {
    const [startDate, endDate] = this.getMonthDateRange(year, month, period);
    console.log(startDate, endDate)

    const lancamentos = await this.lancamentoRepository.find({
      where: {
        data_lancamento: Between(startDate, endDate),
      },
      relations: ['user'],
    });

    const allUserIds = new Set<number>();
    lancamentos.forEach((lancamento) => {
      if (lancamento.auth_usersIds) {
        lancamento.auth_usersIds
          .split(',')
          .forEach((id) => allUserIds.add(Number(id)));
      }
    });

    let usersMap = new Map<number, any>();
    if (allUserIds.size > 0) {
      const users = await this.userRepository.findBy({
        id: In([...allUserIds]),
      });
      usersMap = new Map(users.map((user) => [user.id, user]));
    }

    const lancamentosComUsuarios = lancamentos.map((lancamento) => {
      const userIds = lancamento.auth_usersIds
        ? lancamento.auth_usersIds.split(',').map(Number)
        : [];
      const autorizadopor = userIds
        .map((id) => usersMap.get(id))
        .filter((user) => user !== undefined);
      return { ...lancamento, autorizadopor };
    });

    if (authorized === 1) {
      return lancamentosComUsuarios.filter(
        (lancamento) => lancamento.autorizadopor.length >= 2,
      );
    }

    if (authorized === 0) {
      return lancamentosComUsuarios.filter(
        (lancamento) => lancamento.autorizadopor.length < 2,
      );
    }

    return lancamentosComUsuarios;
  }

  async findByStatus(status: number | null = null): Promise<ItfLancamento[]> {
    const lancamentos = await this.lancamentoRepository.find({
      relations: ['user'],
    });
  
    const allUserIds = new Set<number>();
    lancamentos.forEach((lancamento) => {
      lancamento.auth_usersIds?.split(',').forEach(id => allUserIds.add(Number(id)));
    });
  
    let usersMap = new Map<number, any>();
    if (allUserIds.size > 0) {
      const users = await this.userRepository.findBy({
        id: In([...allUserIds]),
      });
      usersMap = new Map(users.map(user => [user.id, user]));
    }
  
    const lancamentosComUsuarios = lancamentos.map(lancamento => {
      const userIds = lancamento.auth_usersIds ? lancamento.auth_usersIds.split(',').map(Number) : [];
      const autorizadopor = userIds.map(id => usersMap.get(id)).filter(user => user);
      return { ...lancamento, autorizadopor };
    });
  
    if (status === 1) {
      return lancamentosComUsuarios.filter(lancamento => lancamento.autorizadopor.length === 2);
    } else {
      return lancamentosComUsuarios.filter(lancamento => lancamento.autorizadopor.length !== 2);
    }
  }

  async getValorAutorizado(
    month: number,
    period: number,
    year: number,
  ): Promise<any> {
    const [startDate, endDate] = this.getMonthDateRange(year, month, period);

    const response = await this.lancamentoRepository.find({
      where: {
        data_lancamento: Between(startDate, endDate),
      },
    });


    const filteredResponse = response.filter(
      (item) => item.auth_usersIds && item.auth_usersIds.split(',').length >= 2
    );
    console.log('filteredResponse', filteredResponse)

    const sumOfValues = filteredResponse.reduce((acc, curr) => {
      // Remove pontos dos milhares e substitui a vírgula por ponto para torná-lo um número válido
      const valor = parseFloat(curr.valor.replace(/\./g, '').replace(',', '.'));
      return acc + valor;
    }, 0);

    const formattedSum = sumOfValues.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const resp = {
      valor_autorizado: String(formattedSum),
    }

    return resp;
  }

  async create(
    lancamentoData: ItfLancamento,
    userId: number,
  ): Promise<ItfLancamento> {
    const newLancamento = this.lancamentoRepository.create(lancamentoData);
    newLancamento.userId = userId;
    return await this.lancamentoRepository.save(newLancamento);
  }

  async autorizarPagamento(
    userId: number,
    lancamentoId,
    AutorizaLancamentoDto: AutorizaLancamentoDto,
  ): Promise<ItfLancamento> {

    const user = await this.usersService.findOne({
      id: userId,
    });

    if (!user)
      throw new HttpException('Usuário não encontrado', HttpStatus.UNAUTHORIZED);

    const isValidPassword = await bcrypt.compare(
      AutorizaLancamentoDto.password,
      user.password,
    );

    if (!isValidPassword)
      throw new HttpException('Senha inválida', HttpStatus.UNAUTHORIZED);

    const lancamento = await this.lancamentoRepository.findOne({
      where: { id: parseInt(lancamentoId) },
    });
    console.log;

    if (!lancamento) {
      throw new Error('Lançamento não encontrado.');
    }

    const userIds = new Set(
      lancamento.auth_usersIds
        ? lancamento.auth_usersIds.split(',').map(Number)
        : [],
    );
    userIds.add(userId);

    lancamento.auth_usersIds = Array.from(userIds).join(',');
    return await this.lancamentoRepository.save(lancamento);
  }

  async update(
    id: number,
    updatedData: ItfLancamento,
    userId: number,
  ): Promise<ItfLancamento> {
    let lancamento = await this.lancamentoRepository.findOne({ where: { id } });
    if (!lancamento) {
      throw new NotFoundException(`Lançamento com ID ${id} não encontrado.`);
    }

    const { id_cliente_favorecido, ...restUpdatedData } = updatedData;
    lancamento = { ...lancamento, ...restUpdatedData, userId, auth_usersIds: '' };

    await this.lancamentoRepository.save(lancamento);
    console.log(id_cliente_favorecido);

    return lancamento;
  }

  async getById(id: number): Promise<ItfLancamento> {
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

  getDatePeriodInfo(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // Os meses no JavaScript vão de 0 a 11, então é necessário adicionar 1
    const day = date.getDate();

    if (day <= 15) {
      return { year, month, period: 1 };
    } else {
      return { year, month, period: 2 };
    }
  }

}
