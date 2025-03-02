import connection from './db-connection';

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

export const getUserCredits = async (userId: number) => {
  const credits = await connection.query<{ credit_left: number }[]>(
    `select credit_left from user_credit_plan where user_id = ${userId} and expires_on >= '${formatDateTimeForMariaDB()}'`,
  );

  return credits.reduce(
    (accumulator, { credit_left }) => accumulator + credit_left,
    0,
  );
};
