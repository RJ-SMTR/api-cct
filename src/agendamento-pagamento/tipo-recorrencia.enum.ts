export enum TipoRecorrenciaEnum {
  /** Se repete a cada dia. */
  DIARIA = 'Diaria',
  /** Se repete a cada semana. */
  SEMANAL = 'Semanal',
  /** Se repete a cada N dias. */
  INTERVALO_DIAS = 'IntervaloDias',
  /** 
   * Se repete a cada X dias da semana.
   * @example `seg,qua,sex`
   */
  DIAS_SEMANA = 'DiasSemana',
  /** Pagamento feito uma única vez. */
  SEM_RECORRENCIA = 'SemRecorrencia',
}
