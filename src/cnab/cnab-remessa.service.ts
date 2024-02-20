import { Injectable } from '@nestjs/common';
import { CnabFile } from './types/cnab-file.type';
import { CnabRegistro } from './types/cnab-registro.type';
import { Cnab } from './cnab';

@Injectable()
export class CnabRemessaService {
  /**
   * Gerar arquivo remessa
   */
  generateRemessaCnab(cnab: CnabFile) {
    const plainCnab: CnabRegistro[] = [
      cnab.headerArquivo,
      ...cnab.lotes.reduce(
        (l: CnabRegistro[], i) => [
          ...l,
          i.headerLote,
          ...i.registros,
          i.trailerLote,
        ],
        [],
      ),
      cnab.trailerArquivo,
    ];
    const cnabTextList: string[] = [];
    for (const registro of plainCnab) {
      cnabTextList.push(Cnab.getRegistroLine(registro));
    }
    const CNAB_EOL = '\r\n';
    return cnabTextList.join(CNAB_EOL);
  }
}
