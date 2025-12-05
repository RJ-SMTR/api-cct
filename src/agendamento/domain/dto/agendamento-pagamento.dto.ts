import { IsOptional, IsString, IsBoolean, IsDate, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { AprovacaoPagamentoDTO } from './aprovacao-pagamento.dto';
import { PagadorDTO } from 'src/cnab/dto/pagamento/pagador.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

export class AgendamentoPagamentoDTO {
  @IsOptional()
  id?: number;

  @IsOptional()
  @IsString()
  tipoBeneficiario?: string | null; // Consorcio / Individual

  @IsOptional()
  beneficiarioUsuario?: CreateUserDto;

  @IsOptional()
  @IsString()
  tipoPagamento?: string | null; // Unico / Recorrente

  @IsOptional()
  @Type(() => Date)
  dataPagamentoUnico?: Date;

  @IsOptional()
  @IsNumber()
  valorPagamentoUnico?: number;

  @IsOptional()
  @IsString()
  motivoPagamentoUnico?: string;

  @IsOptional()
  pagador: PagadorDTO;

  @IsOptional()
  @IsNumber()
  diaSemana?: number;

  @IsOptional()
  @IsString()
  horario: string;

  @IsOptional()
  responsavel?: CreateUserDto;

  @IsOptional()
  @IsBoolean()
  aprovacao?: boolean;

  diaInicioPagar:number;

  diaFinalPagar:number;

  diaIntervalo: number;

  @IsOptional()
  aprovacaoPagamento?: AprovacaoPagamentoDTO;

  @IsOptional()
  cadastrador?: CreateUserDto;

  @IsOptional()
  modificador?: CreateUserDto;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
  
  createdAt: Date;
}