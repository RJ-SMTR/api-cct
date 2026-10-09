import * as XLSX from 'xlsx';
import { parseWorksheetFromBuffer } from './worksheet-parser.worker';

describe('parseWorksheetFromBuffer', () => {
  it('extracts the same rows from a real xlsx buffer that were put into it', () => {
    const fileUser = {
      codigo_permissionario: 'permitCode1',
      email: 'test@example.com',
      cpf: '59777618212',
      nome: 'Henrique Santos Template',
      telefone: '21912345678',
    };
    const worksheet = XLSX.utils.json_to_sheet([fileUser]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const result = parseWorksheetFromBuffer(buffer);

    expect(XLSX.utils.sheet_to_json(result)).toEqual([fileUser]);
  });
});
