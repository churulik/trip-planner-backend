import axios from 'axios';
import sharp from 'sharp';
import { Request, Response } from 'express';
import connection from '../db-connection.js';
import cache from '../cache.js';
import { PIXABAY_API_KEY } from '../constants.js';

export const getDestinations = async (_: Request, res: Response) => {
  if (cache.has('DESTINATIONS')) {
    res.status(200).send(cache.get('DESTINATIONS'));
    return;
  }

  const destinations = await connection.query<
    { id: number; en: string; country_code: string; population: number }[]
  >(`select * from destination order by substring(en, 1, 1), population desc`);

  const citiesObj: { [key: string]: {}[] } = {};

  destinations.forEach((destination) => {
    const firstLetter = destination.en.charAt(0).toLowerCase();
    if (!citiesObj[firstLetter]) {
      citiesObj[firstLetter] = [];
    }

    const split = destination.en.split(', ');
    const cityObj = {
      id: destination.id,
      city: split[0],
      state: split.length === 3 ? split[1] : undefined,
      country: split.length === 3 ? split[2] : split[1],
      countryCode: destination.country_code.toLowerCase(),
    };
    citiesObj[firstLetter].push(cityObj);
  });

  res.json(citiesObj);
};

export const getDestinationImage = async (req: Request, res: Response) => {
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

    console.log(data);
    if (data.hits.length) {
      const i = Math.floor(Math.random() * data.hits.length);
      const imageResponse = await axios.get(data.hits[i].largeImageURL, {
        responseType: 'arraybuffer',
      });
      const webpBuffer = await sharp(imageResponse.data)
        .webp({ quality: 90 }) // Set WebP quality (0-100)
        .toBuffer();
      res.setHeader('Content-Type', 'image/webp');
      res.send(webpBuffer);
    } else {
      res.send();
    }
  } catch (error) {
    res.status(400).send({ message: 'INVALID_CITY_ID' });
  }
};
