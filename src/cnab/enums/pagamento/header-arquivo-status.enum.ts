export enum HeaderArquivoStatusEnum {
  created = 1,
  remessaSendingFailed = 2,
  /** When Remessa has been sent to SFTP. */
  remessaSent = 3,
  /**  When it has remessa and retorno. Its ready to save in ArquivoPublicacao */
  retornoSaved = 4,
  arquivoPublicacaoSaved = 5,
}