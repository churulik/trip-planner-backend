export const formatDateTimeForMariaDB = (date = new Date()) =>
  date.toISOString().slice(0, 19).replace('T', ' ');

export const setSessionExpirationDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return date;
};
