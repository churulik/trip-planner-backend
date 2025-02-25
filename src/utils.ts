export const formatDateTimeForMariaDB = (date = new Date()) =>
  date.toISOString().slice(0, 19).replace('T', ' ');

export const setSessionExpirationDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date;
};

export const setPlanExpirationDate = (validDay: number) => {
  const date = new Date();
  date.setDate(date.getDate() + validDay);
  return date;
};

export const setJourneyAvailableTillDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};
