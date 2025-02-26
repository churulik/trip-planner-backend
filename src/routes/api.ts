import { Request, Response } from 'express';
import connection from '../db-connection';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';

export const getDestinations = async (_: Request, res: Response) => {
  const destinations = await connection.query<
    { id: number; en: string; iso2: string; population: number }[]
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
      countryCode: destination.iso2.toLowerCase(),
    };
    citiesObj[firstLetter].push(cityObj);
  });

  res.set('Cache-Control', 'public, max-age=5');
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
  const imagePath = path.join(
    __dirname,
    '../assets/icons/journey-details',
    name,
  );

  res.set('Cache-Control', 'public, max-age=5');
  res.sendFile(imagePath, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error sending the image');
    }
  });
};
