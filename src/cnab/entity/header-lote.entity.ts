import { EntityHelper } from 'src/utils/entity-helper';

@Entity()
export class HeaderLote extends EntityHelper {
  id_header_lote: number;
  id_header_arquivo: number;
  lote_servico: string;
  tipo_inscricao: string;
  num_inscricao: string;
  cod_convenio_banco: string;
  tipo_compromisso: string;
  param_transmissao: string;
  id_pagadora: number;
}

function Entity(): (target: typeof HeaderLote) => void | typeof HeaderLote {
  throw new Error('Function not implemented.');
}
