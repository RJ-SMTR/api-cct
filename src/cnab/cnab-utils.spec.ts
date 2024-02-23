import {
  getCnabRegistros,
  stringifyCnab,
  stringifyRegistro,
  validateRegistroPosition,
} from './cnab-utils';
import { CnabFields } from './types/cnab-field.type';
import { CnabFile } from './types/cnab-file.type';
import { CnabLote } from './types/cnab-lote.type';
import { CnabRegistro } from './types/cnab-registro.type';

process.env.TZ = 'UTC';

describe('cnab-utils.ts', () => {
  describe('stringifyCnab()', () => {
    it('should return text version of CnabFile accordingly', () => {
      // Arrange
      const fieldsBase: CnabFields = {
        a: { pos: [1, 100], picture: '9(98)V99', value: '1' },
        b: { pos: [101, 200], picture: 'X(100)', value: ' ' },
        c: { pos: [201, 240], picture: 'X(40)', value: ' ' },
      };
      const cnab: CnabFile = {
        headerArquivo: { fields: fieldsBase },
        lotes: [
          {
            headerLote: { fields: fieldsBase },
            registros: [{ fields: fieldsBase }],
            trailerLote: { fields: fieldsBase },
          },
        ],
        trailerArquivo: { fields: fieldsBase },
      };

      // Act
      const response = stringifyCnab(cnab);

      // Assert
      const responseLine = '0'.repeat(97) + '100' + ' '.repeat(140);
      const expectedResponse =
        responseLine +
        '\r\n' +
        responseLine +
        '\r\n' +
        responseLine +
        '\r\n' +
        responseLine +
        '\r\n' +
        responseLine;
      expect(response.length).toEqual(expectedResponse.length);
      expect(response).toEqual(expectedResponse);
    });
  });

  describe('stringifyRegistro()', () => {
    it('should return text version of Registro accordingly', () => {
      // Arrange
      const registro: CnabRegistro = {
        fields: {
          codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
          loteServico: { pos: [4, 7], picture: '9(004)', value: 1 },
          codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '3' },
          nsr: { pos: [9, 240], picture: 'X(232)', value: 'A' },
        },
      };

      // Act
      const result = stringifyRegistro(registro);

      // Assert
      expect(result).toEqual('10400013A' + ' '.repeat(231));
    });

    it('should throw exception when position doesnt match picture', () => {
      // Arrange
      const registro: CnabRegistro = {
        fields: {
          codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
          loteServico: { pos: [4, 7], picture: '9(004)', value: 1 },
          codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '3' },
          nsr: { pos: [9, 14], picture: '9(005)', value: 1 },
        },
      };

      // Act
      const result = () => stringifyRegistro(registro);

      // Assert
      expect(result).toThrowError();
    });
  });

  describe('validateRegistroPosition()', () => {
    it('should return when previous and current CnabFields have valid positions', () => {
      // Act
      const result = () =>
        validateRegistroPosition(
          {
            picture: 'X(5)',
            pos: [16, 20],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          true,
        );

      // Assert
      expect(result).not.toThrowError();
    });

    it('should return when first CnabField has valid positions', () => {
      // Act
      const result = () =>
        validateRegistroPosition(
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          undefined,
          true,
        );

      // Assert
      expect(result).not.toThrowError();
    });

    it('should return when last CnabField has valid positions', () => {
      // Act
      const result = () =>
        validateRegistroPosition(
          {
            picture: '9(1)',
            pos: [16, 240],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          false,
        );

      // Assert
      expect(result).not.toThrowError();
    });

    it('should throw exception when first CnabField has invalid positions', () => {
      // Act
      const result = () =>
        validateRegistroPosition(
          {
            picture: '9(15)',
            pos: [0, 14],
            value: '',
          },
          undefined,
          true,
        );

      // Assert
      expect(result).toThrowError();
    });

    it('should throw exception when last CnabField has invalid positions', () => {
      // Act
      const result = () =>
        validateRegistroPosition(
          {
            picture: '9(1)',
            pos: [16, 239],
            value: '',
          },
          undefined,
          false,
        );

      // Assert
      expect(result).toThrowError();
    });

    it('should throw exception when previous and current CnabFields have invalid positions', () => {
      // Act
      const resultEqual = () =>
        validateRegistroPosition(
          {
            picture: 'X(5)',
            pos: [15, 29],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          true,
        );
      const resultLower = () =>
        validateRegistroPosition(
          {
            picture: 'X(5)',
            pos: [14, 28],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          true,
        );
      const resultGreather = () =>
        validateRegistroPosition(
          {
            picture: 'X(5)',
            pos: [17, 31],
            value: '',
          },
          {
            picture: '9(15)',
            pos: [1, 15],
            value: '',
          },
          true,
        );

      // Assert
      expect(resultEqual).toThrowError();
      expect(resultLower).toThrowError();
      expect(resultGreather).toThrowError();
    });
  });

  describe('getCnabRegistros()', () => {
    const fields: CnabFields[] = [
      { a: { picture: 'X(1)', pos: [1, 1], value: ' ' } },
      { b: { picture: 'X(2)', pos: [1, 2], value: ' ' } },
      { c: { picture: 'X(3)', pos: [1, 3], value: ' ' } },
      { d: { picture: 'X(4)', pos: [1, 4], value: ' ' } },
      { e: { picture: 'X(5)', pos: [1, 5], value: ' ' } },
      { f: { picture: 'X(6)', pos: [1, 6], value: ' ' } },
      { g: { picture: 'X(7)', pos: [1, 7], value: ' ' } },
      { h: { picture: 'X(8)', pos: [1, 8], value: ' ' } },
      { i: { picture: 'X(9)', pos: [1, 9], value: ' ' } },
      { j: { picture: 'X(10)', pos: [1, 10], value: ' ' } },
      { k: { picture: 'X(11)', pos: [1, 11], value: ' ' } },
      { l: { picture: 'X(12)', pos: [1, 12], value: ' ' } },
      { m: { picture: 'X(13)', pos: [1, 13], value: ' ' } },
      { n: { picture: 'X(14)', pos: [1, 14], value: ' ' } },
      { o: { picture: 'X(15)', pos: [1, 15], value: ' ' } },
      { p: { picture: 'X(16)', pos: [1, 16], value: ' ' } },
      { q: { picture: 'X(17)', pos: [1, 17], value: ' ' } },
      { r: { picture: 'X(18)', pos: [1, 18], value: ' ' } },
      { s: { picture: 'X(19)', pos: [1, 19], value: ' ' } },
      { t: { picture: 'X(20)', pos: [1, 20], value: ' ' } },
      { u: { picture: 'X(21)', pos: [1, 21], value: ' ' } },
      { v: { picture: 'X(22)', pos: [1, 22], value: ' ' } },
      { w: { picture: 'X(23)', pos: [1, 23], value: ' ' } },
      { x: { picture: 'X(24)', pos: [1, 24], value: ' ' } },
    ];

    it('should convert CnabLote record', () => {
      // Arrange
      const registros: CnabRegistro[] = [
        { fields: { ...fields[0], ...fields[1] } },
        { fields: { ...fields[2], ...fields[3] } },
        { fields: { ...fields[4], ...fields[5] } },
        { fields: { ...fields[6], ...fields[7] } },
      ];
      const lote: CnabLote = {
        headerLote: registros[0],
        registros: [registros[1], registros[2]],
        trailerLote: registros[3],
      };

      // Act
      const result = getCnabRegistros(lote);

      // Assert
      expect(result).toEqual(registros);
    });

    it('should convert CnabFile record', () => {
      // Arrange
      const registros: CnabRegistro[] = [
        { fields: { ...fields[0], ...fields[1] } },
        { fields: { ...fields[2], ...fields[3] } },
        { fields: { ...fields[4], ...fields[5] } },
        { fields: { ...fields[6], ...fields[7] } },
        { fields: { ...fields[8], ...fields[9] } },
        { fields: { ...fields[10], ...fields[11] } },
        { fields: { ...fields[12], ...fields[13] } },
        { fields: { ...fields[14], ...fields[15] } },
        { fields: { ...fields[16], ...fields[27] } },
        { fields: { ...fields[18], ...fields[19] } },
      ];
      const lotes: CnabLote[] = [
        {
          headerLote: registros[1],
          registros: [registros[2], registros[3]],
          trailerLote: registros[4],
        },
        {
          headerLote: registros[5],
          registros: [registros[6], registros[7]],
          trailerLote: registros[8],
        },
      ];
      const file: CnabFile = {
        headerArquivo: registros[0],
        lotes,
        trailerArquivo: registros[9],
      };

      // Act
      const result = getCnabRegistros(file);

      // Assert
      expect(result).toEqual(registros);
    });
  });
});
