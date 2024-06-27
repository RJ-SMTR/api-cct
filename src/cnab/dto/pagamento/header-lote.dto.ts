import { IsNotEmpty, ValidateIf } from 'class-validator';
import { Cnab104FormaLancamento } from 'src/cnab/enums/104/cnab-104-forma-lancamento.enum';
import { CnabRegistros104Pgto } from 'src/cnab/interfaces/cnab-240/104/pagamento/cnab-registros-104-pgto.interface';
import { DeepPartial } from 'typeorm';
import { HeaderArquivo } from '../../entity/pagamento/header-arquivo.entity';
import { Pagador } from '../../entity/pagamento/pagador.entity';

function isCreate(object: HeaderLoteDTO): boolean {
  return object.id === undefined;
}

export class HeaderLoteDTO {
  constructor(dto?: DeepPartial<HeaderLoteDTO>) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  headerArquivo?: DeepPartial<HeaderArquivo>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  loteServico?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoInscricao?: string | null;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  numeroInscricao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoConvenioBanco?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  tipoCompromisso?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  parametroTransmissao?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  pagador?: DeepPartial<Pagador>;

  ocorrenciasCnab?: string;

  /** 
   * Usado apenas para geração do remessa, não é salvo no banco 
   * 
   * O formaLancamento depende do codigoBancoFavorecido.
   * /
  codigoBancoFavorecido: string;

  /** Usado apenas para geração do remessa, não é salvo no banco */
  formaLancamento: Cnab104FormaLancamento;

  /** Usado apenas para geração do remessa, não é salvo no banco */
  // itemTransacaoAgrupados: ItemTransacaoAgrupado[] = [];

  /** 
   * Usado apenas para geração do remessa, não é salvo no banco
   * 
   * Após armazenar os itemTransacaoAgrupados, gera os respectivos detalhes
   * e armazena neste DTO para gerar o CNAB.
   */
  registros104: CnabRegistros104Pgto[] = [];
}
