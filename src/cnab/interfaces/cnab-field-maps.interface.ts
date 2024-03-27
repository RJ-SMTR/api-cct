import { ICnabFieldMap } from "./cnab-all/cnab-field-map.interface";

export interface ICnabFieldMaps {
  headerArquivo: ICnabFieldMap;
  headerLote: ICnabFieldMap;
  detalheLote: ICnabFieldMap;
  trailerLote: ICnabFieldMap;
  trailerArquivo: ICnabFieldMap;
}