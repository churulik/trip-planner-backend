import { Request, Response } from 'express';
import connection from '../db-connection';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';

export const getDestinations = async (req: Request, res: Response) => {
  const [etag] = await connection.query<{ value: string }[]>(
    "select value from etag where `key` = 'destination'",
  );

  if (req.headers['if-none-match'] === etag.value) {
    res.status(304).end(); // Resource not modified
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

  res.set('ETag', etag.value);
  res.set('Cache-Control', 'public, max-age=0');
  res.send(citiesObj);
};

export const getDestinationImage = async (req: Request, res: Response) => {
  const { url } = req.params;

  if (!url) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  const response = await axios.get(`https://pixabay.com/get/${url}`, {
    responseType: 'arraybuffer',
  });

  res.setHeader('Content-Type', response.headers['content-type']);
  res.setHeader('Content-Length', response.headers['content-length']);
  res.send(response.data);
};

export const getJourneyImage = async (req: Request, res: Response) => {
  const { name } = req.params;
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const imagePath = path.join(__dirname, '../assets/images', name); // Adjust the path as needed
  res.sendFile(imagePath, (err) => {
    if (err) {
      res.status(500).send('Error sending the image');
    }
  });
};
