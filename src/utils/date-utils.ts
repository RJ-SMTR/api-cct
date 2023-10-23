export function getDateWithTimezone(
  date: Date,
  offsetHours: number,
  offsetMinutes = 0,
): Date {
  const _date = new Date(date);
  _date.setUTCHours(
    _date.getUTCHours() + offsetHours,
    _date.getUTCMinutes() + offsetMinutes,
  );
  return _date;
}

function getDaysToAdd(currentWeekday: number, desiredWeekday: number) {
  currentWeekday = (currentWeekday + 7) % 7;
  desiredWeekday = (desiredWeekday + 7) % 7;
  const daysToAdd = (desiredWeekday - currentWeekday + 7) % 7;
  return daysToAdd;
}

export function getDateNthWeek(dateInput: Date, startWeekday: number): number {
  const epochDate = new Date(1970, 0, 1);
  epochDate.setDate(
    epochDate.getDate() + getDaysToAdd(epochDate.getDay(), startWeekday),
  );
  const millisecondsDifference = dateInput.getTime() - epochDate.getTime();
  const millisecondsInAWeek = 7 * 24 * 60 * 60 * 1000;
  const nthWeekNumber =
    Math.floor(millisecondsDifference / millisecondsInAWeek) + 1;
  return nthWeekNumber;
}
