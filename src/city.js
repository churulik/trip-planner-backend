import connection from './db-connection.js';
import * as fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { nanoid } from 'nanoid';
import axios from 'axios';

export const cities = async (req, res) => {
  const cities = await connection.query(
    `select * from city order by substring(en, 1, 1), population desc`,
  );

  const citiesObj = {};

  cities.forEach((city) => {
    const firstLetter = city.en.charAt(0).toLowerCase();
    if (!citiesObj[firstLetter]) {
      citiesObj[firstLetter] = [];
    }
    const [citySplit, countrySplit] = city.en.split(', ');
    const cityObj = { id: city.id, city: citySplit, country: countrySplit };
    citiesObj[firstLetter].push(cityObj);
  });

  res.send(citiesObj);
};

export const citiesIns = async (req, res) => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const json = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, 'city-pop.json'), 'utf8'),
  );

  const mapped = json.map((c) => {
    return [nanoid(10), `${c.City}, ${c.Country}`, c.Population];
  });

  const cities = await connection.batch(
    'insert ignore into city(id, en, population) values (?,?,?)',
    mapped,
  );
  res.send('OK');
};

export const getCityImage = async (req, res) => {
  const { cityId } = req.query;
  const city = await connection.execute(
    `select * from city where id = '${cityId}' limit 1`,
  );

  if (!city.length) {
    return res.status(400).send({ message: 'INVALID_CITY_ID' });
  }
  const q = city[0].en.split(', ').join('+');
  console.log(q);
  const { data } = await axios(
    `https://pixabay.com/api?key=47567707-216766ed9de92f276c7e3a2ba&q=${q}&horizontal=horizontal&category=travel&editors_choice=false&safesearch=true&per_page=50&image_type=photo`,
  );

  if (data.hits.length) {
    const i = Math.floor(Math.random() * data.hits.length);
    res.send({ image: data.hits[i].largeImageURL });
  } else {
    res.send({});
  }
};
