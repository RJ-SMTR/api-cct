import {
  cropFillCnabField,
  formatDate,
  formatNumber,
  formatText,
  getPictureNumberSize,
  getPictureTextSize,
} from './cnab-utils';
import { CnabFieldType } from './enums/cnab-field-type.enum';
import { CnabField } from './types/cnab-field.type';

process.env.TZ = 'UTC';

describe('cnab-utils.ts', () => {
  describe('getPictureNumberSize()', () => {
    it('should return correct integer and decimal', () => {
      // Act
      const result9Num = getPictureNumberSize('9(15)');
      const result9NumV9Num = getPictureNumberSize('9(3)V9(8)');
      const result9NumInvalidDecimal = getPictureNumberSize('9(3)V');
      const result9NumV9 = getPictureNumberSize('9(4)V99');
      const result9NumV99 = getPictureNumberSize('9(5)V999');
      const resultInvalid = getPictureNumberSize('9()');

      // Assert
      expect(result9Num).toEqual({
        integer: 15,
        decimal: 0,
      });
      expect(result9NumV9Num).toEqual({
        integer: 3,
        decimal: 8,
      });
      expect(result9NumInvalidDecimal).toEqual({
        integer: 3,
        decimal: 0,
      });
      expect(result9NumV9).toEqual({
        integer: 4,
        decimal: 1,
      });
      expect(result9NumV99).toEqual({
        integer: 5,
        decimal: 2,
      });
      expect(resultInvalid).toEqual({
        integer: 0,
        decimal: 0,
      });
    });
  });

  describe('getPictureTextSize()', () => {
    it('should return correct text size', () => {
      // Act
      const resultValid = getPictureTextSize('X(15)');
      const resultInvalid = getPictureTextSize('X()');

      // Assert
      expect(resultValid).toEqual(15);
      expect(resultInvalid).toEqual(0);
    });
  });

  describe('cropFillCnabField()', () => {
    it('should throw error when value size > max size', () => {
      // Arrange
      const result = () =>
        cropFillCnabField('123456', 5, CnabFieldType.Number, 'error');

      // Assert
      expect(() => result()).toThrow();
    });

    it('should neither crop or fill when value size = max size', () => {
      // Arrange
      const resultNumberLeft = cropFillCnabField(
        '123456',
        6,
        CnabFieldType.Number,
        'cropLeft',
      );
      const resultTextLeft = cropFillCnabField(
        '123456',
        6,
        CnabFieldType.Text,
        'cropLeft',
      );
      const resultDateLeft = cropFillCnabField(
        '123456',
        6,
        CnabFieldType.Date,
        'cropLeft',
      );
      const resultNumberRight = cropFillCnabField(
        '123456',
        6,
        CnabFieldType.Number,
        'cropRight',
      );
      const resultTextRight = cropFillCnabField(
        '123456',
        6,
        CnabFieldType.Text,
        'cropRight',
      );
      const resultDateRight = cropFillCnabField(
        '123456',
        6,
        CnabFieldType.Date,
        'cropRight',
      );

      // Assert
      expect(resultNumberLeft).toEqual('123456');
      expect(resultTextLeft).toEqual('123456');
      expect(resultDateLeft).toEqual('123456');
      expect(resultNumberRight).toEqual('123456');
      expect(resultTextRight).toEqual('123456');
      expect(resultDateRight).toEqual('123456');
    });

    it('should crop when value size > max size', () => {
      // Arrange
      const resultNumberLeft = cropFillCnabField(
        '123456',
        4,
        CnabFieldType.Number,
        'cropLeft',
      );
      const resultTextLeft = cropFillCnabField(
        'abcdef',
        4,
        CnabFieldType.Text,
        'cropLeft',
      );
      const resultDateLeft = cropFillCnabField(
        '123456',
        4,
        CnabFieldType.Date,
        'cropLeft',
      );
      const resultNumberRight = cropFillCnabField(
        '123456',
        4,
        CnabFieldType.Number,
        'cropRight',
      );
      const resultTextRight = cropFillCnabField(
        'abcdef',
        4,
        CnabFieldType.Text,
        'cropRight',
      );
      const resultDateRight = cropFillCnabField(
        '123456',
        4,
        CnabFieldType.Date,
        'cropRight',
      );

      // Assert
      expect(resultNumberLeft).toEqual('3456');
      expect(resultTextLeft).toEqual('cdef');
      expect(resultDateLeft).toEqual('3456');
      expect(resultNumberRight).toEqual('1234');
      expect(resultTextRight).toEqual('abcd');
      expect(resultDateRight).toEqual('1234');
    });

    it('should fill when value size < max size', () => {
      // Arrange
      const resultNumberLeft = cropFillCnabField(
        '1234',
        6,
        CnabFieldType.Number,
        'cropLeft',
      );
      const resultTextLeft = cropFillCnabField(
        'abcd',
        6,
        CnabFieldType.Text,
        'cropLeft',
      );
      const resultDateLeft = cropFillCnabField(
        '1234',
        6,
        CnabFieldType.Date,
        'cropLeft',
      );
      const resultNumberRight = cropFillCnabField(
        '1234',
        6,
        CnabFieldType.Number,
        'cropRight',
      );
      const resultTextRight = cropFillCnabField(
        'abcd',
        6,
        CnabFieldType.Text,
        'cropRight',
      );
      const resultDateRight = cropFillCnabField(
        '1234',
        6,
        CnabFieldType.Date,
        'cropRight',
      );

      // Assert
      expect(resultNumberLeft).toEqual('001234');
      expect(resultTextLeft).toEqual('abcd  ');
      expect(resultDateLeft).toEqual('001234');
      expect(resultNumberRight).toEqual('001234');
      expect(resultTextRight).toEqual('abcd  ');
      expect(resultDateRight).toEqual('001234');
    });
  });

  describe('formatDate()', () => {
    it('should format Date as string correctly', () => {
      // Act
      const resultDdmmyyyy = formatDate({
        picture: '9(8)',
        pos: [0, 0],
        value: new Date('2024-03-25'),
        dateFormat: 'ddMMyyyy',
      });
      const resultDdmmyy = formatDate({
        picture: '9(6)',
        pos: [0, 0],
        value: new Date('2024-04-26'),
        dateFormat: 'ddMMyy',
      });
      const resultHhmmss = formatDate({
        picture: '9(6)',
        pos: [0, 0],
        value: new Date('2024-05-27 12:13:14'),
        dateFormat: 'kkmmss',
      });

      // Assert
      expect(resultDdmmyyyy).toEqual('25032024');
      expect(resultDdmmyy).toEqual('260424');
      expect(resultHhmmss).toEqual('121314');
    });

    it('should format string date correctly', () => {
      // Act
      const resultIsoToHms = formatDate({
        picture: '9(6)',
        pos: [0, 0],
        value: '2024-01-02 10:11:12',
        dateFormat: 'hhmmss',
      });
      const resultHmsToHms = formatDate({
        picture: '9(6)',
        pos: [0, 0],
        value: '13:20:57',
        dateFormat: 'HHmmss',
      });
      const resultDateToDate = formatDate({
        picture: '9(8)',
        pos: [0, 0],
        value: '2024-01-03',
        dateFormat: 'ddMMyyyy',
      });
      const resultNoFormat = formatDate({
        picture: '9(8)',
        pos: [0, 0],
        value: '15032024',
      });

      // Assert
      expect(resultIsoToHms).toEqual('101112');
      expect(resultHmsToHms).toEqual('132057');
      expect(resultDateToDate).toEqual('03012024');
      expect(resultNoFormat).toEqual('15032024');
    });
  });

  describe('formatNumber()', () => {
    it('should format Number as string correctly', () => {
      // Arrange
      function setCnabField(value: number, picture: string): CnabField {
        return { pos: [0, 0], picture, value };
      }
      function runFormatNumber(value: number, picture: string) {
        return formatNumber(setCnabField(value, picture));
      }

      // Act
      const resultIntegerCropRight = runFormatNumber(12345678, '9(6)');
      const resultIntegerFillLeft = runFormatNumber(123456, '9(10)');
      const resultIntegerExact = runFormatNumber(123456, '9(6)');
      const resultDecimalCropRight = runFormatNumber(1234567.8, '9(5)V99');
      const resultDecimalFillLeft = runFormatNumber(12345.6, '9(9)V99');
      const resultDecimalExact = runFormatNumber(12345.6, '9(5)V99');
      const resultFillDecimal = runFormatNumber(1234.56, '9(4)V99999');
      const resultCropDecimal = runFormatNumber(1234.5111, '9(4)V999');
      const resultCropDecimalFillLeft = runFormatNumber(1234.5111, '9(8)V999');

      // Assert
      expect(resultIntegerCropRight).toEqual('123456');
      expect(resultIntegerFillLeft).toEqual('0000123456');
      expect(resultIntegerExact).toEqual('123456');
      expect(resultDecimalCropRight).toEqual('123456');
      expect(resultDecimalFillLeft).toEqual('0000123456');
      expect(resultDecimalExact).toEqual('123456');
      expect(resultFillDecimal).toEqual('12345600');
      expect(resultCropDecimal).toEqual('123451');
      expect(resultCropDecimalFillLeft).toEqual('0000123451');
    });

    it('should treat string number the same as Number object', () => {
      // Arrange
      function setCnabField(value: string, picture: string): CnabField {
        return { pos: [0, 0], picture, value };
      }
      function runFormatNumber(value: string, picture: string) {
        return formatNumber(setCnabField(value, picture));
      }

      // Act
      const resultIntegerCropRight = runFormatNumber('12345678', '9(6)');
      const resultDecimalCropRight = runFormatNumber('1234567.8', '9(5)V99');
      const resultCropDecimalFillLeft = runFormatNumber(
        '1234.5111',
        '9(8)V999',
      );

      // Assert
      expect(resultIntegerCropRight).toEqual('123456');
      expect(resultDecimalCropRight).toEqual('123456');
      expect(resultCropDecimalFillLeft).toEqual('0000123451');
    });
  });

  describe('formatText', () => {
    it('should crop or fill text accordingly', () => {
      // Act
      const resultCropped = formatText({
        picture: 'X(5)',
        pos: [0, 0],
        value: 'HELLO WORLD',
      });
      const resultFilled = formatText({
        picture: 'X(10)',
        pos: [0, 0],
        value: 'HELLO',
      });

      // Assert
      expect(resultCropped).toEqual('HELLO');
      expect(resultFilled).toEqual('HELLO     ');
    });

    it('should always convert text to uppercase unaccent', () => {
      // Act
      const resultLowerAccent = formatText({
        picture: 'X(20)',
        pos: [0, 0],
        value: 'Hello açaí!!',
      });

      // Assert
      expect(resultLowerAccent).toEqual('HELLO ACAI          ');
    });
  });
});
