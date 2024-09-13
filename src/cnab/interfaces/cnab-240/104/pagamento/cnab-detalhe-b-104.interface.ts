import { ClienteFavorecido } from 'src/cnab/entity/cliente-favorecido.entity';
import { DetalheBConf } from 'src/cnab/entity/conference/detalhe-b-conf.entity';
import { DetalheB } from 'src/cnab/entity/pagamento/detalhe-b.entity';
import { CnabField, CnabFieldAs } from 'src/cnab/interfaces/cnab-all/cnab-field.interface';
import { Cnab104PgtoTemplates } from 'src/cnab/templates/cnab-240/104/pagamento/cnab-104-pgto-templates.const';
import { getTipoInscricao } from 'src/cnab/utils/cnab/cnab-utils';
import { asString } from 'src/utils/pipe-utils';

/**
 * @extends {CnabFields}
 */
export interface CnabDetalheB_104 {
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

export class CnabDetalheB_104DTO implements CnabDetalheB_104 {
  constructor(dto: CnabDetalheB_104) {
    Object.assign(this, dto);
  }

  static fromEntity(detalheB: DetalheB | DetalheBConf, favorecido: ClienteFavorecido) {
    const detalheBDTO = new CnabDetalheB_104DTO(structuredClone(Cnab104PgtoTemplates.file104.registros.detalheB));
    detalheBDTO.tipoInscricao.value = getTipoInscricao(asString(favorecido.cpfCnpj));
    detalheBDTO.numeroInscricao.value = asString(favorecido.cpfCnpj);
    detalheBDTO.dataVencimento.value =detalheB.dataVencimento;
    detalheBDTO.logradouro.value = favorecido.logradouro;
    detalheBDTO.numeroLocal.value = favorecido.numero;
    detalheBDTO.complemento.value = favorecido.complemento;
    detalheBDTO.bairro.value = favorecido.bairro;
    detalheBDTO.cidade.value = favorecido.cidade;
    detalheBDTO.cep.value = favorecido.cep;
    detalheBDTO.complementoCep.value = favorecido.complementoCep;
    detalheBDTO.siglaEstado.value = favorecido.uf;
    detalheBDTO.nsr.value = detalheB.nsr;
    return detalheBDTO;
  }

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
