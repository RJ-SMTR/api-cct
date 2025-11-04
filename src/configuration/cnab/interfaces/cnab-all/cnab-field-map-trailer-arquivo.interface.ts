import { ICnabFieldMap } from './cnab-field-map.interface';

export interface ICnabFieldMapTrailerArquivo extends ICnabFieldMap {
  trailerArquivoLoteCountField: string;
  trailerArquivoRegistroCountField: string;
}
