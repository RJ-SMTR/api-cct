export interface ICnabRegistroFieldMap {
  // REGISTRO FIELDS

  /**
   * Represents"LoteServico" or similar fields.
   *
   * Each **Lote** has one unique combination of `tipoCompromisso` and `formaLancamento`.
   *
   * Also represents the amount of Lotes field in Trailer
   */
  registroLoteField: string;

  /**
   * Represents "CodigoRegistro" field or similar.
   *
   * Also represents the amount of Lotes field in Trailer
   *
   * @example "1", "3", "5"
   *
   */
  registroCodigoField: string;

  // SOME DETAILS AND TRAILER_ARQUIVO FIELDS

  /** Represents individual or sum of unique recipient bank accounts */
  registroRecipientAccountField?: string;

  // DETALHES FIELDS

  /** For each Lote, count starting from 1 for each Registro */
  detalheNsrField?: string;

  /** @example "A", "B", "J" */
  detalhesSegmentoField?: string;
}
