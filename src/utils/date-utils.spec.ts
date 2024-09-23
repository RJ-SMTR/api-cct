import { formatDateISODate, formatDateISODateSlash, getDateFromCnabName, getNthWeek, isPaymentWeekComplete, isSameNthWeek } from './date-utils';
import { WeekdayEnum } from './enums/weekday.enum';

process.env.TZ = 'UTC';

describe('date-utils', () => {
  describe('isPaymentWeekComplete', () => {
    it('Should be complete when input date is wednesday and today is friday in the same week', /**
     * Requirement: {@link https://github.com/RJ-SMTR/api-cct/issues/177#issuecomment-1934531824 Issue #177, item 2 - GitHub}
     *
     * Expected logic:
     * ```
     * Input date           a Today date           b
     * ╔════════════════════╗ ╔════════════════════╗
     * ║ February      2023 ║ ║ February      2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢ ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║ ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║  |  |  |  |01│02│03║ ║  |  |  |  |01│02│03║
     * ╟──┼──┼──╔══╗──┼──┼──╢ ╟──┼──┼──┼──┼──╔══╗──╢
     * ║04│05│06║07║08│09│10║ ║04│05│06│07│08║09║10║
     * ╟──┼──┼──╚══╝──┼──┼──╢ ╟──┼──┼──┼──┼──╚══╝──╢
     * ║11│12│13│14│15│16│17║ ║11│12│13│14│15│16│17║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║18│19│20│21│22│23│24║ ║18│19│20│21│22│23│24║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║25│26│27|28|29|  |  ║ ║25│26│27|28|29|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝ ╚══╧══╧══╧══╧══╧══╧══╝
     *
     * Payment week         c Payment compete in   d
     * ╔════════════════════╗ ╔════════════════════╗
     * ║ Febuary       2023 ║ ║ Febuary       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢ ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║ ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──╔══╗──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║  |  |  |  ║01║02│03║ ║  |  |  |  |01│02│03║
     * ╟──┼──┼──╔══╗══╝──┼──╢ ╟──┼──┼──┼──┼──╔══╗──╢
     * ║04│05│06║07║08│09│10║ ║04│05│06│07│08║09║10║
     * ╟──┼──┼──╚══╝──┼──┼──╢ ╟──┼──┼──┼──┼──╚══╝──╢
     * ║11│12│13│14│15│16│17║ ║11│12│13│14│15│16│17║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║18│19│20│21│22│23│24║ ║18│19│20│21│22│23│24║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║25│26│27|28|29|  |  ║ ║25│26│27|28|29|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝ ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     */ () => {
      // Arrange
      jest.spyOn(global.Date, 'now').mockImplementation(() => new Date('2024-02-09').valueOf());

      // Act
      const isComplete = isPaymentWeekComplete(new Date('2024-02-07'));

      // Assert
      expect(isComplete).toBeTruthy();
    });

    it('Should be complete when input date is wednesday and today is any day in the future week', /**
     * Requirement: {@link https://github.com/RJ-SMTR/api-cct/issues/177#issuecomment-1934531824 Issue #177, item 2 - GitHub}
     *
     * Expected logic:
     * ```
     * Input date           a Today date           b
     * ╔════════════════════╗ ╔════════════════════╗
     * ║ February      2023 ║ ║ February      2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢ ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║ ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║  |  |  |  |01│02│03║ ║  |  |  |  |01│02│03║
     * ╟──┼──┼──╔══╗──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║04│05│06║07║08│09│10║ ║04│05│06│07│08│09│10║
     * ╟──┼──┼──╚══╝──┼──┼──╢ ╟──╔══╗──┼──┼──┼──┼──╢
     * ║11│12│13│14│15│16│17║ ║11║12║13│14│15│16│17║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──╚══╝──┼──┼──┼──┼──╢
     * ║18│19│20│21│22│23│24║ ║18│19│20│21│22│23│24║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║25│26│27|28|29|  |  ║ ║25│26│27|28|29|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝ ╚══╧══╧══╧══╧══╧══╧══╝
     *
     * Payment week         c Payment compete in   d
     * ╔════════════════════╗ ╔════════════════════╗
     * ║ Febuary       2023 ║ ║ Febuary       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢ ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║ ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──╔══╗──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║  |  |  |  ║01║02│03║ ║  |  |  |  |01│02│03║
     * ╟──┼──┼──╔══╗══╝──┼──╢ ╟──┼──┼──┼──┼──╔══╗──╢
     * ║04│05│06║07║08│09│10║ ║04│05│06│07│08║09║10║
     * ╟──┼──┼──╚══╝──┼──┼──╢ ╟──┼──┼──┼──┼──╚══╝──╢
     * ║11│12│13│14│15│16│17║ ║11│12│13│14│15│16│17║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║18│19│20│21│22│23│24║ ║18│19│20│21│22│23│24║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║25│26│27|28|29|  |  ║ ║25│26│27|28|29|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝ ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     */ () => {
      // Arrange
      jest.spyOn(global.Date, 'now').mockImplementation(() => new Date('2024-02-12').valueOf());

      // Act
      const isComplete = isPaymentWeekComplete(new Date('2024-02-07'));

      // Assert
      expect(isComplete).toBeTruthy();
    });

    it('Should not be complete when input date is wednesday and today is thursday in the same week', /**
     * Requirement: {@link https://github.com/RJ-SMTR/api-cct/issues/177#issuecomment-1934531824 Issue #177, item 3 - GitHub}
     *
     * Expected logic:
     * ```
     * Input date           a Today date           b
     * ╔════════════════════╗ ╔════════════════════╗
     * ║ February      2023 ║ ║ February      2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢ ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║ ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║  |  |  |  |01│02│03║ ║  |  |  |  |01│02│03║
     * ╟──┼──┼──╔══╗──┼──┼──╢ ╟──┼──┼──┼──╔══╗──┼──╢
     * ║04│05│06║07║08│09│10║ ║04│05│06│07║08║09│10║
     * ╟──┼──┼──╚══╝──┼──┼──╢ ╟──┼──┼──┼──╚══╝──┼──╢
     * ║11│12│13│14│15│16│17║ ║11│12│13│14│15│16│17║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║18│19│20│21│22│23│24║ ║18│19│20│21│22│23│24║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║25│26│27|28|29|  |  ║ ║25│26│27|28|29|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝ ╚══╧══╧══╧══╧══╧══╧══╝
     *
     * Payment week         c Payment compete in   d
     * ╔════════════════════╗ ╔════════════════════╗
     * ║ Febuary       2023 ║ ║ Febuary       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢ ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║ ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──╔══╗──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║  |  |  |  ║01║02│03║ ║  |  |  |  |01│02│03║
     * ╟──┼──┼──╔══╗══╝──┼──╢ ╟──┼──┼──┼──┼──╔══╗──╢
     * ║04│05│06║07║08│09│10║ ║04│05│06│07│08║09║10║
     * ╟──┼──┼──╚══╝──┼──┼──╢ ╟──┼──┼──┼──┼──╚══╝──╢
     * ║11│12│13│14│15│16│17║ ║11│12│13│14│15│16│17║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║18│19│20│21│22│23│24║ ║18│19│20│21│22│23│24║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║25│26│27|28|29|  |  ║ ║25│26│27|28|29|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝ ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     */ () => {
      // Arrange
      jest.spyOn(global.Date, 'now').mockImplementation(() => new Date('2024-02-08').valueOf());

      // Act
      const isComplete = isPaymentWeekComplete(new Date('2024-02-07'));

      // Assert
      expect(isComplete).toBeFalsy();
    });

    it('Should not be complete when input date is wednesday and today is any day before friday of the same week', /**
     * Requirement: {@link https://github.com/RJ-SMTR/api-cct/issues/177#issuecomment-1934531824 Issue #177, item 3 - GitHub}
     *
     * Expected logic:
     * ```
     * Input date           a Today date           b
     * ╔════════════════════╗ ╔════════════════════╗
     * ║ February      2023 ║ ║ February      2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢ ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║ ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──╔══╗──╢
     * ║  |  |  |  |01│02│03║ ║  |  |  |  |01║02║03║
     * ╟──┼──┼──╔══╗──┼──┼──╢ ╟──┼──┼──┼──┼──╚══╝──╢
     * ║04│05│06║07║08│09│10║ ║04│05│06│07│08│09│10║
     * ╟──┼──┼──╚══╝──┼──┼──╢ ╟──╔══╗──┼──┼──┼──┼──╢
     * ║11│12│13│14│15│16│17║ ║11║12║13│14│15│16│17║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──╚══╝──┼──┼──┼──┼──╢
     * ║18│19│20│21│22│23│24║ ║18│19│20│21│22│23│24║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║25│26│27|28|29|  |  ║ ║25│26│27|28|29|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝ ╚══╧══╧══╧══╧══╧══╧══╝
     *
     * Payment week         c Payment compete in   d
     * ╔════════════════════╗ ╔════════════════════╗
     * ║ Febuary       2023 ║ ║ Febuary       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢ ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║ ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──╔══╗──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║  |  |  |  ║01║02│03║ ║  |  |  |  |01│02│03║
     * ╟──┼──┼──╔══╗══╝──┼──╢ ╟──┼──┼──┼──┼──╔══╗──╢
     * ║04│05│06║07║08│09│10║ ║04│05│06│07│08║09║10║
     * ╟──┼──┼──╚══╝──┼──┼──╢ ╟──┼──┼──┼──┼──╚══╝──╢
     * ║11│12│13│14│15│16│17║ ║11│12│13│14│15│16│17║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║18│19│20│21│22│23│24║ ║18│19│20│21│22│23│24║
     * ╟──┼──┼──┼──┼──┼──┼──╢ ╟──┼──┼──┼──┼──┼──┼──╢
     * ║25│26│27|28|29|  |  ║ ║25│26│27|28|29|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝ ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     */ () => {
      // Arrange
      jest.spyOn(global.Date, 'now').mockImplementation(() => new Date('2024-02-02').valueOf());

      // Act
      const isComplete = isPaymentWeekComplete(new Date('2024-02-07'));

      // Assert
      expect(isComplete).toBeFalsy();
    });
  });

  describe('isSameNthWeek', () => {
    it('Should be true if fri - thu is the same payment week', /**
     * Expected logic:
     * ```
     * Payment week
     * ╔════════════════════╗
     * ║ Febuary       2023 ║
     * ╟──┬──┬──┬──┬──┬──┬──╢
     * ║Su│Mo│Tu│We│Th│Fr│Sa║
     * ╟──┼──┼──┼──┼──╔══╗──╢
     * ║  |  |  |01│02║03║04║
     * ╟──┼──┼──┼──╔══╗══╝──╢
     * ║05│06│07│08║09║10│11║
     * ╟──┼──┼──┼──╚══╝──┼──╢
     * ║12│13│14│15│16│17│18║
     * ╟──┼──┼──┼──┼──┼──┼──╢
     * ║19│20│21│22│23│24│25║
     * ╟──┼──┼──┼──┼──┼──┼──╢
     * ║26│27│28|29|30|  |  ║
     * ╚══╧══╧══╧══╧══╧══╧══╝
     * ```
     */ () => {
      // Act
      const isTheSame = isSameNthWeek(new Date('2023-02-03'), new Date('2023-02-09'), WeekdayEnum._5_FRIDAY);

      // Assert
      expect(isTheSame).toBeTruthy();
    });
  });

  describe('getNthWeek', () => {
    it('Should match nthWeek correctly', () => {
      // Act
      const testWeekDay = WeekdayEnum._5_FRIDAY;
      const test = {
        _01dom: getNthWeek(new Date('2024-06-02'), testWeekDay),
        _02seg: getNthWeek(new Date('2024-06-03'), testWeekDay),
        _03ter: getNthWeek(new Date('2024-06-04'), testWeekDay),
        _04qua: getNthWeek(new Date('2024-06-05'), testWeekDay),
        _05qui: getNthWeek(new Date('2024-06-06'), testWeekDay),
        _06sex: getNthWeek(new Date('2024-06-07'), testWeekDay),
        _07sab: getNthWeek(new Date('2024-06-08'), testWeekDay),
        _08dom: getNthWeek(new Date('2024-06-09'), testWeekDay),
        _09seg: getNthWeek(new Date('2024-06-10'), testWeekDay),
        _10ter: getNthWeek(new Date('2024-06-11'), testWeekDay),
        _11qua: getNthWeek(new Date('2024-06-12'), testWeekDay),
        _12qui: getNthWeek(new Date('2024-06-13'), testWeekDay),
        _13sex: getNthWeek(new Date('2024-06-14'), testWeekDay),
        _14sab: getNthWeek(new Date('2024-06-15'), testWeekDay),
      };

      // Assert
      expect(test._04qua).toEqual(2839);
      expect(test._05qui).toEqual(2839);
      expect(test._06sex).toEqual(2840);
      expect(test._07sab).toEqual(2840);
      expect(test._08dom).toEqual(2840);
      expect(test._09seg).toEqual(2840);
      expect(test._10ter).toEqual(2840);
      expect(test._11qua).toEqual(2840);
      expect(test._12qui).toEqual(2840);
      expect(test._13sex).toEqual(2841);
    });
  });

  describe('formatDateISODate', () => {
    it('Should return ISO date correctly', () => {
      // Arrange
      const date = new Date('2024-09-20T01:02:03');
      // Act
      const result = formatDateISODate(date);
      // Assert
      expect(result).toEqual('2024-09-20');
    });
  });

  describe('formatDateISODateSlash', () => {
    it('Should return ISO date with slashes', () => {
      // Arrange
      const date = new Date('2024-09-20T01:02:03');
      // Act
      const result = formatDateISODateSlash(date);
      // Assert
      expect(result).toEqual('2024/09/20');
    });
  });

  describe('getDateFromCnabName', () => {
    it('Should throw error when cnab name is invalid', () => {
      // Arrange
      const cnabName = 'smtr_prefeiturarj_05042024_114658';
      // Act
      const response = () => getDateFromCnabName(cnabName);
      // Assert
      expect(response).toThrowError();
    });

    it('Should throw error when cnab date is invalid', () => {
      // Arrange
      const cnabName = 'smtr_prefeiturarj_04-04-24/114658.ret';
      // Act
      const response = () => getDateFromCnabName(cnabName);
      // Assert
      expect(response).toThrowError();
    });

    it('Should return Date for retornoPagamento', () => {
      // Arrange
      const cnabName = 'smtr_prefeiturarj_05042024_114658.ret';
      // Act
      const date = getDateFromCnabName(cnabName);
      // Assert
      expect(date).toEqual(new Date('2024-04-05T11:46:58'));
    });

    it('Should return Date for retornoExtrato', () => {
      // Arrange
      const cnabName = 'smtr_prefeiturarj_eediario_05042024_114658.ext';
      // Act
      const date = getDateFromCnabName(cnabName);
      // Assert
      expect(date).toEqual(new Date('2024-04-05T11:46:58'));
    });

    it('Should return Date for retornoComprovante', () => {
      // Arrange
      const cnabName = 'smtr_prefeiturarj_05042024_114658.cmp';
      // Act
      const date = getDateFromCnabName(cnabName);
      // Assert
      expect(date).toEqual(new Date('2024-04-05T11:46:58'));
    });
  });
});
