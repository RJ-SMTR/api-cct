export class HeaderLoteDTO {
  constructor(dto?: HeaderLoteDTO) {
    if (dto) {
      Object.assign(this, dto);
    }
  }

  id_header_lote: number;
  id_header_arquivo: number;
  lote_servico: string;
  tipo_inscricao: string;
  num_inscricao: string;
  cod_convenio_banco: string;
  tipo_compromisso: string;
  param_transmissao: string;
  id_pagador: number;
}
