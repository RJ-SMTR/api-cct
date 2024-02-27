import { Injectable } from '@nestjs/common';
import { CnabFile } from './types/cnab-file.type';
import { getCnabRegistros, stringifyCnabRegistro } from './utils/cnab-utils';
import { CNAB_EOL } from './cnab-consts';

@Injectable()
export class CnabRemessaService {
  /**
   * Generate CNAB Remessa text content from CnabFile
   */
  generateRemessaCnab(cnab: CnabFile): string {
    const plainCnab = getCnabRegistros(cnab);
    const cnabTextList: string[] = [];
    for (const registro of plainCnab) {
      cnabTextList.push(stringifyCnabRegistro(registro));
    }
    return cnabTextList.join(CNAB_EOL);
  }
}
