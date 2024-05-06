import { IsNotEmpty, ValidateIf } from 'class-validator';
import { DeepPartial } from 'typeorm';
import { HeaderArquivo } from '../entity/pagamento/header-arquivo.entity';
import { Transacao } from '../entity/pagamento/transacao.entity';

function isCreate(object: ArquivoPublicacaoDTO): boolean {
  return object.id === undefined;
}

export class ArquivoPublicacaoDTO {
  constructor(dto?: ArquivoPublicacaoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id?: number;

  // Remessa
  @ValidateIf(isCreate)
  @IsNotEmpty()
  headerArquivo?: DeepPartial<HeaderArquivo>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  transacao?: DeepPartial<Transacao>;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  idHeaderLote?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataGeracaoRemessa?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  horaGeracaoRemessa?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataGeracaoRetorno?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  horaGeracaoRetorno?: Date;

  // Pagador, DetalheA Retorno
  @ValidateIf(isCreate)
  @IsNotEmpty()
  loteServico?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomePagador?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agenciaPagador?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvAgenciaPagador?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  contaPagador?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvContaPagador?: string;

  // Favorecido
  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomeCliente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cpfCnpjCliente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codigoBancoCliente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  agenciaCliente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvAgenciaCliente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  contaCorrenteCliente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dvContaCorrenteCliente?: string;

  // Retorno CNAB
  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataVencimento?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorLancamento?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  dataEfetivacao?: Date;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  valorRealEfetivado?: number;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  ocorrencias?: string;

  /** Unique id reference */

  @ValidateIf(isCreate)
  @IsNotEmpty()
  idDetalheARetorno?: number;

  isPago?: boolean;
}
