import { CnabFile } from "src/cnab/interfaces/cnab-file.interface";
import { getCnabFileFrom104 } from "src/cnab/utils/cnab-104-pipe-utils";
import { setCnab104Metadata } from "src/cnab/utils/cnab-metadata-utils";
import { Cnab104ExtratoFile104Templates } from "./cnab-104-extrato-file-104-templates.const";

const sc = structuredClone;

const cnabExtRetFile104 = sc(Cnab104ExtratoFile104Templates);
setCnab104Metadata(cnabExtRetFile104, 'CnabExtRet');

export const cnab104ExtratoFileTemplates = {
  file: {
    dto: {
      retorno: {
        ...getCnabFileFrom104(cnabExtRetFile104),
        _metadata: { type: 'CnabFileExtrato' }
      } as CnabFile,
    }
  },
}