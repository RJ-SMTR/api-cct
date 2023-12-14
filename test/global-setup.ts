import { differenceInMinutes } from 'date-fns';

module.exports = () => {
  global.__localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localDateStr = new Date().toString();
  process.env.TZ = 'UTC';
  global.__localTzOffset = differenceInMinutes(
    new Date(localDateStr.split(' GMT')[0]).getTime(),
    new Date().getTime(),
  );
};
