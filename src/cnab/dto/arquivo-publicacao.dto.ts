import { IsNotEmpty, ValidateIf } from "class-validator";
import { DeepPartial } from "typeorm";
import { HeaderArquivo } from "../entity/pagamento/header-arquivo.entity";

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
  headerArquivo: DeepPartial<HeaderArquivo>;
  idTransacao: number;
  idHeaderLote: number;
  dataGeracaoRemessa: Date;
  horaGeracaoRemessa: Date;
  dataGeracaoRetorno: Date;
  horaGeracaoRetorno: Date;

  // Pagador, DetalheA Retorno
  loteServico: number;
  nomePagador: string;
  agenciaPagador: string;
  dvAgenciaPagador: string;
  contaPagador: string;
  dvContaPagador: string;

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
  ocorrencias: string;

  /** Unique id reference */

  @ValidateIf(isCreate)
  @IsNotEmpty()
  idDetalheARetorno: number;
}