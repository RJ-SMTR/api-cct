import { IsNotEmpty, ValidateIf } from "class-validator";

function isCreate(object: ArquivoPublicacaoDTO): boolean {
  return object.id === undefined;
}

export class ArquivoPublicacaoDTO {
  constructor(dto?: ArquivoPublicacaoDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }
  id: number;

  idHeaderArquivo: number;
  idTransacao: number;
  idHeaderLote: number;
  dataGeracaoRemessa: Date;
  horaGeracaoRemessa: Date;
  dataGeracaoRetorno: Date;
  horaGeracaoRetorno: Date;


  loteServico: number;
  nomePagador: string;
  agenciaPagador: string;
  dvAgenciaPagador: string;
  contaPagador: string;
  dvContaPagador: string;


  @ValidateIf(isCreate)
  @IsNotEmpty()
  nomeCliente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  cpfCnpjCliente?: string;

  @ValidateIf(isCreate)
  @IsNotEmpty()
  codBancoCliente?: string;

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

  ocorrencias: string;
}