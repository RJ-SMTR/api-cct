import { Injectable } from '@nestjs/common';
import { CnabFile } from './types/cnab-file.type';
import { getPlainRegistros, getRegistroLine } from './cnab-utils';

@Injectable()
export class CnabRemessaService {
  /**
   * Generate CNAB Remessa text content from CnabFile
   */
  generateRemessaCnab(cnab: CnabFile): string {
    const plainCnab = getPlainRegistros(cnab);
    const cnabTextList: string[] = [];
    for (const registro of plainCnab) {
      cnabTextList.push(getRegistroLine(registro));
    }
    const CNAB_EOL = '\r\n';
    return cnabTextList.join(CNAB_EOL);
  }
}
