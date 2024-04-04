import { CnabFile } from "src/cnab/interfaces/cnab-all/cnab-file.interface";
import { getCnabFileFrom104 } from "src/cnab/utils/cnab/cnab-104-pipe-utils";
import { setCnab104Metadata } from "src/cnab/utils/cnab/cnab-metadata-utils";
import { CnabFile104ExtratoTemplate } from "./cnab-file-104-extrato-template.const";

const sc = structuredClone;

const cnabExtRetFile104 = sc(CnabFile104ExtratoTemplate);
setCnab104Metadata(cnabExtRetFile104, 'CnabExtratoRetorno');

export const cnab104ExtratoTemplates = {
  file: {
    dto: {
      retorno: {
        ...getCnabFileFrom104(cnabExtRetFile104),
        _metadata: { type: 'CnabFileExtrato' }
      } as CnabFile,
    }
  },
}