export enum TransacaoStatusEnum {
  created = 1,
  /** sendRemessa */
  remessa = 2,
  /** saveRemessa */
  retorno = 3,
  /** compareRemessaRetorno */
  publicado = 4,
}
