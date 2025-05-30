import { DeepPartial } from 'typeorm';
import { RelatorioExtratoBancarioDto } from './relatorio-extrato-bancario.dto';

export class RelatorioExtratoBancarioResponseDto {
  constructor(extratoResponse?: DeepPartial<RelatorioExtratoBancarioResponseDto>) {
    if (extratoResponse !== undefined) {
      Object.assign(this, extratoResponse);
    }
  }  
  extrato: RelatorioExtratoBancarioDto[];
  saldoConta: number;
}