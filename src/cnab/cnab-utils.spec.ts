import { getRegistroLine, validateRegistroPosition } from './cnab-utils';
import { CnabRegistro } from './types/cnab-registro.type';

process.env.TZ = 'UTC';

describe('cnab-utils.ts', () => {
  describe('getRegistroLine()', () => {
    it('should return text version of Registro accordingly', () => {
      // Arrange
      const registro: CnabRegistro = {
        codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
        loteServico: { pos: [4, 7], picture: '9(004)', value: 1 },
        codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '3' },
        nsr: { pos: [9, 240], picture: 'X(232)', value: 'A' },
      };

      // Act
      const result = getRegistroLine(registro);

      // Assert
      expect(result).toEqual('10400013A' + ' '.repeat(231));
    });

    it('should throw exception when position doesnt match picture', () => {
      // Arrange
      const registro: CnabRegistro = {
        codigoBanco: { pos: [1, 3], picture: '9(003)', value: '104' },
        loteServico: { pos: [4, 7], picture: '9(004)', value: 1 },
        codigoRegistro: { pos: [8, 8], picture: '9(001)', value: '3' },
        nsr: { pos: [9, 14], picture: '9(005)', value: 1 },
      };

      // Act
      const result = () => getRegistroLine(registro);

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
});
