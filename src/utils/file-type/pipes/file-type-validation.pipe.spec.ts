import * as XLSX from 'xlsx';
import { FileTypeValidationPipe } from './file-type-validation.pipe';

function buildFile(buffer: Buffer, mimetype: string): Express.Multer.File {
  return { buffer, mimetype } as Express.Multer.File;
}

describe('FileTypeValidationPipe', () => {
  it('rejects a plain text file disguised with a spreadsheet mimetype', () => {
    const file = buildFile(
      Buffer.from('this is not a spreadsheet, just plain text'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    const pipe = new FileTypeValidationPipe(['spreadsheet', 'csv']);

    expect(() => pipe.transform(file)).toThrow();
  });

  it('accepts a real .xlsx file whose content matches the declared spreadsheet mimetype', () => {
    const worksheet = XLSX.utils.json_to_sheet([{ a: 1 }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const file = buildFile(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const pipe = new FileTypeValidationPipe(['spreadsheet', 'csv']);

    expect(() => pipe.transform(file)).not.toThrow();
  });

  it('accepts a real .csv file whose content is plain delimited text', () => {
    const file = buildFile(
      Buffer.from('codigo_permissionario,email,nome,telefone,cpf\n1,a@b.com,Fulano,219999,123\n'),
      'text/csv',
    );

    const pipe = new FileTypeValidationPipe(['spreadsheet', 'csv']);

    expect(() => pipe.transform(file)).not.toThrow();
  });

  it('rejects an empty file instead of throwing an unrelated error while reading its bytes', () => {
    const file = buildFile(Buffer.alloc(0), 'text/csv');

    const pipe = new FileTypeValidationPipe(['spreadsheet', 'csv']);

    expect(() => pipe.transform(file)).toThrow(/does not match/i);
  });

  it('still rejects a disallowed mimetype before even checking content (regression)', () => {
    const file = buildFile(Buffer.from('<html></html>'), 'text/html');

    const pipe = new FileTypeValidationPipe(['spreadsheet', 'csv']);

    expect(() => pipe.transform(file)).toThrow(/invalid file type/i);
  });
});
