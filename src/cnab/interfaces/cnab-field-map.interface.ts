export interface ICnabFieldMap {
  // ALL REGISTROS

  /**
   * For all Registros
   *
   * Represents"LoteServico" or similar fields.
   *
   * Each **Lote** has one unique combination of
   * 1. `tipoCompromisso` ("serviceType"; e.g. payments, debit, collection etc); and
   * 2. `formaLancamento` ("transactionType"; e.g. TED, DOC etc).
   *
   * The values must be:
   * - **For Header Arquivo:** value is 0000.
   * - **For Header/Trailer Lote and Detalhes:** Count current Lote. Example: (1, 2, 3).
   * - **For Trailer Arquivo:** value is 9999.
   *
   * @example "1", "2", "3"
   */
  registroLoteSequenceField: string;

  /**
   * For all Registros
   *
   * Represents "CodigoRegistro" field or similar.
   *
   * @example "0", "1", "3", "5", "9"
   *
   */
  registroIdField: string;

  // FOR TRAILER LOTE

  /**
   * For Trailer Lote
   *
   * Represents the count of all Registro in Lote
   */
  trailerLoteRegistroCountField?: string;

  // FOR REGISTO DETALHE

  /**
   * For Segmento Detalhe Registros
   *
   * Represents NSR (_Número Sequencial de Registro, no Lote_)
   *
   * For each Lote, count starting from 1 for each Registro
   *
   * @example "1", "2", "3"
   */
  detalheLoteRegistroSequenceField?: string;

  /**
   * For Segmento Detalhe Registros
   *
   * Represents Detalhe's unique code
   *
   * @example "A", "B", "J"
   */
  detalheSegmentoField?: string;

  // TRAILER ARQUIVO FIELDS

  /**
   * For Trailer Arquivo
   *
   * Represents the count of lote in CnabFile (Registro type = 1)
   */
  trailerArquivoLoteCountField?: string;

  /**
   * For Trailer Arquivo
   *
   * Represents the count of all Registro in file (types 1, 3, 5 or 9)
   */
  trailerArquivoRegistroCountField?: string;
}
