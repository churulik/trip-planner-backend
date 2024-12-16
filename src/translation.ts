import connection from './db-connection.js';
import { Request, Response } from 'express';

const getFirstAcceptLanguage = (acceptLanguage: string) => {
  try {
    let firstLanguage = acceptLanguage.split(',')[0].toLowerCase();
    if (firstLanguage.startsWith('en')) {
      return 'en';
    }

    if (firstLanguage.startsWith('es')) {
      return 'es';
    }
  } catch (e) {}

  return 'en';
};

export const getTranslation = async (req: Request, res: Response) => {
  let language = req.query.language as string | undefined;

  if (!language) {
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      language = getFirstAcceptLanguage(acceptLanguage);
    }
  }

  if (!language || ['en', 'es'].indexOf(language) === -1) {
    language = 'en';
  }

  const rows = await connection.query<{ key: string; [key: string]: string }[]>(
    `SELECT \`key\`, ${language} FROM translation`,
  );

  const toJson = rows.reduce(
    (accumulator: { [key: string]: string }, current) => {
      accumulator[current.key] = current[language];
      return accumulator;
    },
    {},
  );

  res.send({
    language,
    translations: toJson,
  });
};

export const getLanguages = async (_: Request, res: Response) => {
  const rows = await connection.query(`SELECT * FROM language`);
  res.send(rows);
};
