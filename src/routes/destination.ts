import axios from 'axios';
import { Request, Response } from 'express';
import connection from '../db-connection.js';
import { PIXABAY_API_KEY } from '../constants.js';
import { nanoid } from 'nanoid';
import { fileURLToPath } from 'url';
import path from 'path';
import { formatDateTimeForMariaDB } from '../utils';

export const getDestinationImageUrls = async (req: Request, res: Response) => {
  const { id } = req.params;
  const city = await connection.execute(
    `select * from destination where id = '${id}' limit 1`,
  );

  if (!city.length) {
    res.status(400).send({ message: 'INVALID_CITY_ID' });
    return;
  }

  try {
    const q = city[0].en.split(', ').join('+');
    const { data } = await axios(
      //&editors_choice=true
      `https://pixabay.com/api?key=${PIXABAY_API_KEY}&q=${q}&horizontal=horizontal&category=places&editors_choice=false&safesearch=true&per_page=50&image_type=photo&editors_choice=true`,
    );

    if (data.hits.length) {
      const i1 = Math.floor(Math.random() * data.hits.length);
      const i2 = Math.floor(Math.random() * data.hits.length);
      const i3 = Math.floor(Math.random() * data.hits.length);
      const baseUrl = 'http://localhost/api/image/destination/';
      const pixabayUrl = 'https://pixabay.com/get/';
      const [, url1] = data.hits[i1].webformatURL.split(pixabayUrl);
      const [, url2] = data.hits[i2].webformatURL.split(pixabayUrl);
      const [, url3] = data.hits[i3].webformatURL.split(pixabayUrl);
      res.send([`${baseUrl}${url1}`, `${baseUrl}${url2}`, `${baseUrl}${url3}`]);
    } else {
      res.send([]);
    }
  } catch (error) {
    res.status(400).send({ message: 'INVALID_CITY_ID' });
  }
};

export const insertDest = async (req: Request, res: Response) => {
  const rows = await connection.query<
    {
      city: string;
      country: string;
      admin_name: string;
      population: number;
      iso2: string;
    }[]
  >('select * from worldcities');

  const batchValues: [string, string, string, number][] = [];

  rows.forEach((row) => {
    batchValues.push([
      nanoid(),
      `${row.city}${row.iso2 !== 'US' ? '' : `, ${row.admin_name}`}, ${row.country}`,
      row.iso2,
      row.population || 0,
    ]);
  });

  await connection.batch(
    'insert ignore into destination (id, en, country_code, population) values (?, ?, ?, ?)',
    batchValues,
  );

  res.send('OK');
};

export const getDestinationIcon = async (req: Request, res: Response) => {
  const { name } = req.params;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imagePath = path.join(__dirname, '../assets/icons/countries', name);

  const [etag] = await connection.query<{ value: string }[]>(
    "select value from etag where `key` = 'icon_country'",
  );

  res.set('ETag', etag.value);

  if (req.headers['if-none-match'] === etag.value) {
    res.status(304).end();
    return;
  }

  res.set('Cache-Control', 'public, max-age=10');
  res.sendFile(imagePath, (err) => {
    if (err) {
      const imagePath = path.join(
        __dirname,
        '../assets/icons/countries/default.svg',
      );
      res.sendFile(imagePath);
    }
  });
};

export const insertVisitor = async (req: Request, res: Response) => {
  await connection.query(
    `insert into visitor (ip, created_on) values ('${req.ip}', '${formatDateTimeForMariaDB()}')`,
  );
  res.send();
};
