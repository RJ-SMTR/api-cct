import { IsDateString, IsNotEmpty, IsNumber, IsNumberString, IsString, ValidateIf } from 'class-validator';
import { isSameDay, nextFriday } from 'date-fns';
import { TipoFavorecidoEnum } from 'src/cnab/enums/tipo-favorecido.enum';
import { DeepPartial } from 'typeorm';

/**
 * Logic:
 * - It has 1 `id_ordem_pagamento` per day.
 * - id_ordem_pagamento repeats by combination of id_consorcio (CNPJ), id_operadora (CPF), servico (vehicle)
 */
export class BigqueryOrdemPagamentoDTO {
  constructor(bqOrdem?: DeepPartial<BigqueryOrdemPagamentoDTO>) {
    if (bqOrdem !== undefined) {
      Object.assign(this, bqOrdem);
    }
  }

  /** id_ordem_pagamento_consorcio_operador_dia */
  @IsNotEmpty()
  id: number;
  
  /**
   * Data da ordem de pagamento (partição)
   *
   * Para filtrar e ordenar por data
   * 
   * @example `2024-12-25`
   */
  @IsNotEmpty()
  @IsDateString()
  dataOrdem: string;

  /**
   * Data de pagamento da ordem
   *
   * Se a dataPagamento for nula, iremos efetuar o pagamento.
   * Senão, ignoramos o item.
   */
  @ValidateIf((o, v) => v !== null)
  @IsDateString()
  dataPagamento: string | null;

  /**
   * Id de cadastro.consorcios
   *
   * id_consorcio.cnpj = CNPJ
   */
  @IsNotEmpty()
  @IsString()
  idConsorcio: string;

  /** Nome do consórcio, para referência */
  consorcio: string;

  /**
   * Identificador da operadora na tabela cadastro.operadoras
   *
   * id_operadora.documento = CPF
   */
  idOperadora: string;

  /** Nome da operadora */
  operadora: string;

  /** Nome curto da linha operada com variação de serviço (ex: 010, 011SN, ...) */
  @IsNotEmpty()
  @IsString()
  servico: string;

  /**
   * Identificador da ordem pagamento no banco de dados da Jaé
   *
   * Agrupamos um arquivo CNAB por id_ordem_pagamento.
   *
   * Cada **data_ordem** possui um id_ordem_pagamento único.
   * Cada **id_ordem_pagamento** possui vários **id_operadora** (favorecidoBele CPF),
   * **id_consorico** (favorecido CNPJ) e **servico** (veículo que arrecadou)
   */
  @IsNotEmpty()
  @IsNumberString()
  idOrdemPagamento: string;

  /** Identificador da ordem ressarcimento no banco de dados da Jaé */
  idOrdemRessarcimento: string | null;

  /** Quantidade de transações feitas na modalidade débito */
  quantidadeTransacaoDebito: number | null;

  /** Valor total das transações feitas na modalidade débito (R$) */
  valorDebito: number | null;

  /** Quantidade de transações feitas em espécie */
  quantidadeTransacaoEspecie: number | null;

  /** Valor total das transações feitas em espécie (R$) */
  valorEspecie: number | null;

  /** Quantidade de transações feitas com gratuidade */
  quantidadeTransacaoGratuidade: number | null;

  /** Valor total das transações feitas com gratuidade (R$) */
  valorGratuidade: number | null;

  /** Quantidade de transações feitas com integração */
  quantidadeTransacaoIntegracao: number | null;

  /** Valor total das transações feitas com integração (R$) */
  valorIntegracao: number | null;

  /** Número de transações com rateio de crédito */
  quantidadeTransacaoRateioCredito: number | null;

  /** Valor total das transações com rateio de crédito (R$) */
  valorRateioCredito: number | null;

  /** Número de transações com rateio de débito */
  quantidadeTransacaoRateioDebito: number | null;

  /** Valor total das transações com rateio de débito (R$) */
  valorRateioDebito: number | null;

  /** Quantidade total de transações realizadas */
  quantidadeTotalTransacao: number | null;

  /** Valor total das transações realizadas (R$) */
  @IsNotEmpty()
  @IsNumber()
  valorTotalTransacaoBruto: number;

  /** Valor da taxa descontado do valor total (R$) */
  valorDescontoTaxa: number | null;

  /** Valor total das transações menos o valor_desconto_taxa (R$) */
  valorTotalTransacaoLiquido: number;

  /** Quantidade total de transações calculada pela captura de transações */
  quantidadeTotalTransacaoCaptura: number | null;

  /** Valor total das transações realizadas calculada pela captura de transações (R$) */
  valorTotalTransacaoCaptura: number | null;

  /** Indicador de validação da ordem de pagamento */
  indicadorOrdemValida: boolean | null;

  /** Código de controle de versão do dado (SHA Github) */
  versao: string;

  // CUSTOM COLUMNS

  operadoraTipoDocumento: string;

  /** operadora.documento (cpf/cnpj) */
  operadoraCpfCnpj: string | null;

  /** consorcios.cnpj */
  consorcioCnpj: string | null;

  tipoFavorecido: TipoFavorecidoEnum | null;

  datetimeUltimaAtualizacao: Date;

  dataCaptura: Date;

  public static findAgrupado(ordemAgs: BigqueryOrdemPagamentoDTO[], ordem: BigqueryOrdemPagamentoDTO, newDataOrdem = nextFriday(new Date())) {
    const filtered = ordemAgs.filter((i) => isSameDay(new Date(i.dataOrdem), newDataOrdem) && i.idConsorcio === ordem.idConsorcio)[0];
    return filtered ? filtered : null;
  }
}
