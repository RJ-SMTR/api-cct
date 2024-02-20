import { getPictureNumberSize } from './cnab-utils';

describe('cnab-utils.ts', () => {
  describe('getPictureNumberSize()', () => {
    it('should return correct integer and decimal', () => {
      // Act
      const result9Num = getPictureNumberSize('9(15)');
      const result9NumV9Num = getPictureNumberSize('9(3)V9(8)');
      const result9NumInvalidDecimal = getPictureNumberSize('9(3)V');
      const result9NumV9 = getPictureNumberSize('9(4)V99');
      const result9NumV99 = getPictureNumberSize('9(5)V999');

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
    });
  });

  // describe('getCnabPictureValue()', () => {
  //   it('should return Currency value', () => {
  //     // Act
  //     const result = getCnabPictureValue({
  //       pos: [163, 177],
  //       picture: '9(013)V99',
  //       value: '512.3',
  //     });
  //     // Assert
  //     expect(result).toEqual("0000000051230");
  //   });
  // });
});
