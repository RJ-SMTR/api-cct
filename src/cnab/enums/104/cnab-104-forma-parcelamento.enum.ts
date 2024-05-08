export enum Cnab104FormaParcelamento {
  /**
   * Data Fixa, significa que será efetuado no dia informado,
   * por exemplo, se for informado 05, será efetuado o lançamento no dia 05 de cada mês;
   */
  DataFixa = 1,

  /**
   * Periódico, significa que será efetuado a cada período informado, por exemplo, se for informado 05, será efetuado a cada 5 dias;
   */
  Periodico = 2,

  /**
   * Dia útil, significa que será efetuado no dia útil informado, por exemplo,
   * se for informado 05, será efetuado no 5º dia útil do mês.
   */
  DiaUtil = 3,
}
