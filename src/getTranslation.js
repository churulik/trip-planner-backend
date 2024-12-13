import connection from './db-connection.js';

const getFirstAcceptLanguage = (acceptLanguage) => {
  try {
    let firstLanguage = acceptLanguage.split(',')[0].toLowerCase();
    if (firstLanguage.startsWith('en')) {
      return 'en';
    }

    if (firstLanguage.startsWith('es')) {
      return 'es';
    }
  } catch (e) {
    return 'en';
  }
};

export const getTranslation = async (req, res) => {
  let language = req.query.language;

  if (!language) {
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      language = getFirstAcceptLanguage(acceptLanguage);
    }
  }

  if (['en', 'es'].indexOf(language) === -1) {
    language = 'en';
  }

  const rows = await connection.query(
    `SELECT \`key\`, ${language} FROM translation`,
  );

  const toJson = rows.reduce((accumulator, current) => {
    accumulator[current.key] = current[language];
    return accumulator;
  }, {});

  res.send({
    language,
    translations: toJson,
  });
};

export const getLanguages = async (req, res) => {
  const rows = await connection.query(`SELECT * FROM language`);
  res.send(rows);
};
