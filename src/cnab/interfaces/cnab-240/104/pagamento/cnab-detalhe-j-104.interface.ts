import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { DetalheBConf } from 'src/cnab/entity/conference/detalhe-b-conf.entity';
import { DetalheB } from 'src/cnab/entity/pagamento/detalhe-b.entity';
import { DetalheJ } from 'src/cnab/entity/pagamento/detalhe-j.entity0';
import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { getTipoInscricao } from 'src/cnab/utils/cnab/cnab-utils';
import { asString } from 'src/utils/pipe-utils';

/**
 * @extends {CnabFields}
 */
export interface CnabDetalheJ_104 {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<number>;
  nsr: CnabFieldAs<number>;
  codigoSegmento: CnabFieldAs<string>;
  usoExclusivoFebraban: CnabField;
  tipoInscricao: CnabField;
  numeroInscricao: CnabField;
  logradouro: CnabField;
  numeroLocal: CnabField;
  complemento: CnabField;
  bairro: CnabField;
  cidade: CnabField;
  cep: CnabField;
  complementoCep: CnabField;
  siglaEstado: CnabField;
  dataVencimento: CnabField;
  valorDocumento: CnabField;
  valorAbatimento: CnabField;
  valorDesconto: CnabField;
  valorMora: CnabField;
  valorMulta: CnabField;
  codigoDocumentoFavorecido: CnabField;
  usoExclusivoFebraban2: CnabField;
}

// export class CnabDetalheJ_104DTO implements CnabDetalheJ_104 {
//   constructor(dto: CnabDetalheJ_104) {
//     Object.assign(this, dto);
//   }

//   static fromEntity(detalheB: DetalheJ | DetalheBConf, favorecido: ClienteFavorecido) {
//     const detalheBDTO = new CnabDetalheJ_104DTO(structuredClone(Cnab104PgtoTemplates.file104.registros.detalheB));
//     detalheBDTO.tipoInscricao.value = getTipoInscricao(asString(favorecido.cpfCnpj));
//     detalheBDTO.numeroInscricao.value = asString(favorecido.cpfCnpj);
//     detalheBDTO.dataVencimento.value = detalheB.dataVencimento;
//     detalheBDTO.logradouro.value = favorecido.logradouro;
//     detalheBDTO.numeroLocal.value = favorecido.numero;
//     detalheBDTO.complemento.value = favorecido.complemento;
//     detalheBDTO.bairro.value = favorecido.bairro;
//     detalheBDTO.cidade.value = favorecido.cidade;
//     detalheBDTO.cep.value = favorecido.cep;
//     detalheBDTO.complementoCep.value = favorecido.complementoCep;
//     detalheBDTO.siglaEstado.value = favorecido.uf;
//     detalheBDTO.nsr.value = detalheB.nsr;
//     return detalheBDTO;
//   }

//   codigoBanco: CnabField;
//   loteServico: CnabField;
//   codigoRegistro: CnabFieldAs<number>;
//   nsr: CnabFieldAs<number>;
//   codigoSegmento: CnabFieldAs<string>;
//   tipoMovimento: CnabField;
//   codigoMovimento: CnabField;
//   bancoDestino: CnabField;
//   /**
//    * J.09 - Código Moeda - preencher com o código da moeda conforme constante da 4a posição
//    * na barra da cobrança ou com zero para pagamento de Pix QR Code:
//    * 
//    * - `9` Real;
//    * - `2` Moeda Variável;
//    * - `0` Pix QR Code;
//    *
//    * Retornado conforme recebido.
//    */
//   codigoMoeda: CnabField;
//   dvCodigoBarras: CnabField;
//   fatorVencimento: CnabField;
//   valorDocumento: CnabFieldAs<number>;
//   campoLivre: CnabFieldAs<string>;
//   nomeCedente: CnabFieldAs<string>;
//   dataVencimento: CnabFieldAs<Date>;
//   valorTitulo: CnabFieldAs<number>;
//   /** Valor do desconto + abatimento */
//   valorDescontoAbatimento: CnabFieldAs<number>;
//   /** Valor da mora + multa */
//   valorMoraMulta: CnabFieldAs<number>;
//   dataPagamento: CnabFieldAs<Date>;
//   valorPagamento: CnabFieldAs<number>;
//   quantidadeMoeda: CnabFieldAs<number>;
//   numeroDocumentoEmpresa: CnabField;
//   filler: CnabField;
//   numeroDocumentoBanco: CnabField;
//   filler2: CnabField;
//   /**
//    * J.26 - Código da Moeda - preencher com o código da moeda prevista para o boleto,
//    * conforme abaixo:
//    * 
//    * - `04`: TRD;
//    * - `02`: Dólar;
//    * - `06`: UFIR diária;
//    * - `09`: Real;
//    * 
//    * Retornado conforme recebido.
//    */
//   codigoMoeda2: CnabField;
//   usoExclusivoFebraban: CnabField;
//   codigoDocumentoFavorecido: CnabField;
//   usoExclusivoFebraban2: CnabField;
// }
