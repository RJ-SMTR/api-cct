import { IsDateString } from 'class-validator';
import { DeepPartial } from 'typeorm';

export class BigqueryOrdemPagamentoGuardadorDTO {
  constructor(bqOrdem?: DeepPartial<BigqueryOrdemPagamentoGuardadorDTO>) {
    if (bqOrdem !== undefined) {
      Object.assign(this, bqOrdem);
    }
  }

  /** Data da ordem de pagamento (partição) */
  dataOrdem: string;

  /** CPF do guardador do veículo */
  cpfGuardadorVeiculo: string | null;

  /** Quantidade total de verificações */
  quantidadeVerificacaoTotal: string;

 /** Quantidade de verificações válidas */
  quantidadeVerificacaoValida: string;

 /** Quantidade de verificações inválidas */
  quantidadeVerificacaoInvalida: string;

  /** Valor do repasse ao guardador do veículo (R$) */
  valorRepasseGuardadorVeiculo: number | null;

  /** Código de controle de versão do dado (SHA Github) */
  versao: string;

  /** Data de inclusão */
  dataInclusao: Date;

   /** Data de última atualização */
  dateTimeUltimaAtualizacao: Date;

  tipoOrdemPagamento: string;

  userId: number | undefined;
}