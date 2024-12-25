import OpenAI from 'openai';
import {
  OPENAI_API_KEY,
  USER_JOURNEY_CRYPTO_SECRET_KEY,
} from '../constants.js';
import { Request, Response } from 'express';
import trip from '../mock/florence.json';
import crypto from 'crypto';
import connection from '../db-connection.js';
import { nanoid } from 'nanoid';
import { formatDateTimeForMariaDB } from '../utils.js';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const MAP_MARKER_LETTER = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

export const getJourney = async (req: Request, res: Response) => {
  try {
    const itinerary = trip.itinerary.map((itinerary) => {
      const dayAddresses: string[] = [];
      let activityNumber = 0;

      const dayActivities = itinerary.dayActivities.map((dayActivity) => {
        const timeActivities = dayActivity.timeActivities.map(
          (timeActivity) => {
            dayAddresses.push(
              `${timeActivity.place.name}, ${timeActivity.place.address}`,
            );
            return {
              activity: timeActivity.activity,
              description: timeActivity.description,
              address: `${timeActivity.place.name}, ${timeActivity.place.address}`,
              markerLetter: MAP_MARKER_LETTER[activityNumber++],
            };
          },
        );

        return { ...dayActivity, timeActivities };
      });

      return { ...itinerary, dayActivities, dayAddresses };
    });

    res.send({ ...trip, itinerary });
  } catch (e: any) {
    console.error(e.message);
    res.status(400).send({ message: '' });
  }
};

const CRYPTO_ALGORITHM = 'aes-256-gcm';

export const saveJourney = async (req: Request, res: Response) => {
  const { journey } = req.body;

  if (!journey) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  const key = Buffer.from(USER_JOURNEY_CRYPTO_SECRET_KEY, 'base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(CRYPTO_ALGORITHM, key, iv);
  let encryptedJourney = cipher.update(
    JSON.stringify(journey),
    'utf8',
    'base64',
  );
  encryptedJourney += cipher.final('base64');
  const ivBase64 = iv.toString('base64');
  const authTag = cipher.getAuthTag();
  const authTagBase64 = authTag.toString('base64');

  await connection.execute(
    'insert into journey (id, user_id, journey, created_on, iv, auth_tag) values(?, ?, ?, ? ,?, ?)',
    [
      nanoid(),
      req.user?.id,
      encryptedJourney,
      formatDateTimeForMariaDB(),
      ivBase64,
      authTagBase64,
    ],
  );

  res.send({ message: 'JOURNEY_SAVED' });
};

export const getJourneys = async (req: Request, res: Response) => {
  const dbUserJourneys = await connection.execute<Journey[]>(
    'select * from journey where user_id = ?',
    [req.user?.id],
  );

  const key = Buffer.from(USER_JOURNEY_CRYPTO_SECRET_KEY, 'base64');
  const userJourneys = dbUserJourneys.map(
    ({ id, journey, iv, auth_tag, created_on }) => {
      const decipher = crypto.createDecipheriv(
        CRYPTO_ALGORITHM,
        key,
        Buffer.from(iv, 'base64'),
      );

      const authTag = Buffer.from(auth_tag, 'base64');
      decipher.setAuthTag(authTag);

      let decryptedJourney = decipher.update(journey, 'base64', 'utf8');
      decryptedJourney += decipher.final('utf8');

      return {
        id,
        journey: JSON.parse(decryptedJourney),
        createdOn: created_on,
      };
    },
  );

  res.send(userJourneys);
};

export const deleteJourney = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  const rows = await connection.execute<{
    affectedRows: number;
    insertId: number;
    warningStatus: number;
  }>('delete from journey where id = ? and user_id = ?', [id, req.user?.id]);

  if (rows.affectedRows === 0) {
    res.status(404).send({ message: 'NOT_FOUND' });
    return;
  }

  res.send({ message: 'DELETED' });
};
