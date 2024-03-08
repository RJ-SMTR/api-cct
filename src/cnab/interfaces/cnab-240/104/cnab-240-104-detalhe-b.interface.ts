import { CnabAllCodigoRegistro as CnabAllCodigoRegistro } from 'src/cnab/enums/all/cnab-all-codigo-registro.enum';
import {
  CnabField,
  CnabFieldAs,
  CnabFields,
} from '../../../types/cnab-field.type';
import { Cnab104CodigoSegmento } from 'src/cnab/enums/104/cnab-104-codigo-segmento.enum';

export interface ICnab240_104DetalheB extends CnabFields {
  codigoBanco: CnabField;
  loteServico: CnabField;
  codigoRegistro: CnabFieldAs<CnabAllCodigoRegistro>;
  nsr: CnabField;
  codigoSegmento: CnabFieldAs<Cnab104CodigoSegmento>;
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
