import { Injectable } from '@nestjs/common';
import { CnabFile } from './types/cnab-file.type';
import { getCnabRegistros, stringifyRegistro } from './cnab-utils';

@Injectable()
export class CnabRemessaService {
  /**
   * Generate CNAB Remessa text content from CnabFile
   */
  generateRemessaCnab(cnab: CnabFile): string {
    const plainCnab = getCnabRegistros(cnab);
    const cnabTextList: string[] = [];
    for (const registro of plainCnab) {
      cnabTextList.push(stringifyRegistro(registro));
    }
    const CNAB_EOL = '\r\n';
    return cnabTextList.join(CNAB_EOL);
  }
}
