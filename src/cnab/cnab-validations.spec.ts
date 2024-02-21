import {
  validateCnabFieldPositionSize,
  validateRegistroPosition,
} from './cnab-validations';

process.env.TZ = 'UTC';

describe('cnab-validations.ts', () => {
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

  describe('validateCnabFieldPositionSize()', () => {
    it('should return if position mathches picture', () => {
      // Act
      const result15 = () =>
        validateCnabFieldPositionSize({
          picture: '9(15)',
          pos: [1, 15],
          value: '',
        });
      const result1 = () =>
        validateCnabFieldPositionSize({
          picture: 'X(1)',
          pos: [1, 1],
          value: '',
        });

      // Assert
      expect(result15).not.toThrowError();
      expect(result1).not.toThrowError();
    });

    it('should throw exception when position size doesnt match picture', () => {
      // Act
      const result = () =>
        validateCnabFieldPositionSize({
          picture: 'X(1)',
          pos: [1, 2],
          value: '',
        });

      // Assert
      expect(result).toThrowError();
    });

    it('should throw exception when position start is invalid', () => {
      // Act
      const result = () =>
        validateCnabFieldPositionSize({
          picture: 'X(1)',
          pos: [0, 1],
          value: '',
        });

      // Assert
      expect(result).toThrowError();
    });

    it('should throw exception when position end < start', () => {
      // Act
      const result = () =>
        validateCnabFieldPositionSize({
          picture: 'X(1)',
          pos: [2, 1],
          value: '',
        });

      // Assert
      expect(result).toThrowError();
    });

    it('should throw exception when picture size < 1', () => {
      // Act
      const result = () =>
        validateCnabFieldPositionSize({
          picture: 'X(0)',
          pos: [1, 1],
          value: '',
        });

      // Assert
      expect(result).toThrowError();
    });
  });
});
