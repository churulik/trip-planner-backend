import OpenAI from 'openai';
import {
  GOOGLE_PLACES_API_KEY,
  OPENAI_API_KEY,
  USER_JOURNEY_CRYPTO_SECRET_KEY,
} from '../constants.js';
import { Request, Response } from 'express';
import trip from '../mock/la.json';
import crypto from 'crypto';
import connection from '../db-connection.js';
import { nanoid } from 'nanoid';
import {
  formatDateTimeForMariaDB,
  setJourneyAvailableTillDate,
} from '../utils.js';
import { AiJourneyResponse, Journey, JourneyResponse } from '../definitions';
import axios from 'axios';

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

const insertJourney = async (userId: number, journey: JourneyResponse) => {
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

  const createdOn = formatDateTimeForMariaDB();
  const id = nanoid();
  await connection.execute(
    'insert into journey (id, user_id, journey, created_on, iv, auth_tag, saved_till) values(?, ?, ?, ? ,?, ?, ?)',
    [
      id,
      userId,
      encryptedJourney,
      createdOn,
      ivBase64,
      authTagBase64,
      formatDateTimeForMariaDB(setJourneyAvailableTillDate()),
    ],
  );

  return { id, createdOn, journey };
};

const addPlacesAddress = async (journey: AiJourneyResponse) => {
  const places: {
    [key: string]: {
      id: string;
      name: string;
      location: { lat: number; lng: number };
    } | null;
  } = {};
  journey.itinerary.forEach((itinerary) => {
    itinerary.dayActivities.forEach((dayActivity) => {
      dayActivity.timeActivities.forEach(
        (timeActivity) =>
          (places[
            `${timeActivity.place.name}, ${timeActivity.place.city}, ${timeActivity.place.country}`
          ] = null),
      );
    });
  });

  // Check what of the places are on the db
  const whereClauses: string[] = [];
  const whereValues: string[] = [];

  for (const [key] of Object.entries(places)) {
    whereClauses.push('name = ?');
    whereValues.push(key);
  }

  const placesRows = await connection.execute<
    {
      name: string;
      google_place_id: string;
      latitude: number;
      longitude: number;
    }[]
  >(
    `select name, google_place_id, latitude, longitude from place where ${whereClauses.join(' or ')}`,
    whereValues,
  );

  placesRows.forEach((placeRow) => {
    if (places[placeRow.name] === null) {
      places[placeRow.name] = {
        id: placeRow.google_place_id,
        name: placeRow.name,
        location: {
          lat: +placeRow.latitude,
          lng: +placeRow.longitude,
        },
      };
    }
  });

  const placesWithoutAddress = Object.keys(places).filter(
    (key) => places[key] === null,
  );

  if (placesWithoutAddress.length) {
    const placesToInsert: [string, string, number, number][] = [];
    for (const placeName of placesWithoutAddress) {
      // Get places addresses
      const { data } = await axios.post<{
        places: {
          id: string;
          displayName: { text: string; languageCode: string };
          location: { latitude: number; longitude: number };
        }[];
      }>(
        'https://places.googleapis.com/v1/places:searchText',
        {
          textQuery: placeName,
          languageCode: 'en',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
          },
        },
      );

      const googlePlace = data.places.length ? data.places[0] : undefined;

      if (googlePlace) {
        const lat = Number(googlePlace.location.latitude.toFixed(8));
        const lng = Number(googlePlace.location.longitude.toFixed(8));
        places[placeName] = {
          id: googlePlace.id,
          name: placeName,
          location: {
            lat,
            lng,
          },
        };

        placesToInsert.push([placeName, googlePlace.id, lat, lng]);
      }
    }

    placesToInsert.length &&
      (await connection.batch(
        'insert into place (name, google_place_id, latitude, longitude) values (?, ?, ?, ?)',
        placesToInsert,
      ));
  }

  return places;
};

export const generateJourney = async (req: Request, res: Response) => {
  const { cityId } = req.body;

  if (!cityId) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  const [destination] = await connection.query<
    { en: string; query_count: number }[]
  >(`select en, query_count from destination where id = '${cityId}'`);

  if (!destination) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  try {
    await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      store: false,
      messages: [{ role: 'user', content: 'write a haiku about ai' }],
    });
  } catch (error: any) {
    await connection.query(
      `insert into ai_error_log (req, res, user_id, created_on) values('${destination.en}', '${error.message}', ${req.user!.id}, '${formatDateTimeForMariaDB()}')`,
    );
  }

  try {
    const places = await addPlacesAddress(trip as any);

    const itinerary = trip.itinerary.map((itinerary) => {
      const dayPlaces: {
        id: string;
        name: string;
        markerLabel: string;
        location: { lat: number; lng: number };
      }[] = [];
      let activityNumber = 0;

      const dayActivities = itinerary.dayActivities.map(
        (dayActivity, dayIndex) => {
          const timeActivities = dayActivity.timeActivities.map(
            (timeActivity) => {
              const placeAddress =
                places[
                  `${timeActivity.place.name}, ${timeActivity.place.city}, ${timeActivity.place.country}`
                ];
              if (placeAddress) {
                dayPlaces.push({
                  id: placeAddress.id,
                  name: placeAddress.name,
                  markerLabel: MAP_MARKER_LETTER[dayIndex],
                  location: placeAddress.location,
                });
              }

              return {
                activity: timeActivity.activity,
                description: timeActivity.description,
                address: timeActivity.place.name,
                markerLetter: MAP_MARKER_LETTER[activityNumber++],
              };
            },
          );

          return { ...dayActivity, timeActivities };
        },
      );

      const origin = `origin=${dayPlaces[0].name}`;
      const originPlaceId = `origin_place_id=${dayPlaces[0].id}`;
      const destination = `destination=${dayPlaces[dayPlaces.length - 1].name}`;
      const destinationPlaceId = `destination_place_id=${dayPlaces[dayPlaces.length - 1].id}`;
      const placesForWaypoints = dayPlaces.filter(
        (_, i) => i !== 0 && i !== dayPlaces.length - 1,
      );
      const waypoints = `waypoints=${placesForWaypoints
        .map((p) => p.name)
        .join('|')}`;
      const waypointsPlaceId = `waypoint_place_ids=${placesForWaypoints
        .map((p) => p.id)
        .join('|')}`;

      return {
        ...itinerary,
        dayActivities,
        dayPlaces,
        googleMapsLink: encodeURI(
          `https://www.google.com/maps/dir/?api=1&${origin}&${originPlaceId}&${destination}&${destinationPlaceId}&${waypoints}&${waypointsPlaceId}&travelmode=walking`,
        ),
      };
    });

    const journeyToDb = {
      ...trip,
      city: {
        lat: trip.city.lat,
        lng: trip.city.lng,
        flag: trip.city.iso2.toLowerCase(),
      },
      itinerary,
    };

    const output = await insertJourney(req.user!.id, journeyToDb);

    await connection.query(
      `update destination set query_count = destination.query_count + 1 where id = '${cityId}'`,
    );

    res.send(output);
  } catch (e: any) {
    console.error(e.message);
    res.status(400).send({ message: '' });
  }
};

const CRYPTO_ALGORITHM = 'aes-256-gcm';

export const saveJourney = async (req: Request, res: Response) => {
  const { id } = req.body;

  if (!id) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  await connection.query(
    `update journey set saved_till = null where id = '${id}'`,
  );

  res.send({ message: 'JOURNEY_PERMANENTLY_SAVED' });
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

  res.send({ message: 'DELETED', id });
};

export const journeyDetail = async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization;

  let planId = '';
  if (!sessionId) {
    const [freePlan] = await connection.query<{ id: string }[]>(
      'select id from credit_plan where price = 0',
    );
    planId = freePlan.id;
  }

  const detailsDB = await connection.query<
    {
      id: string;
      name: string;
      icon: string;
      category_id: number;
      category_name: string;
      is_multi_select: boolean;
    }[]
  >(`
    select jd.*, jc.name as category_name, jc.is_multi_select
        from  journey_detail jd
        join journey_category jc on jc.id = jd.category_id
    where not exists (
        select 1
        from credit_plan_journey_detail_exclusion cpjd
        where cpjd.journey_detail_id = jd.id
          and cpjd.credit_plan_id = '${planId}'
    )
    order by category_id, \`order\`
  `);

  const journeyDetails: {
    duration: number;
    exactDays: boolean;
    options: {
      category: string;
      types: {
        id: string;
        name: string;
        icon: string;
        svg?: string;
        isMultiSelect: boolean;
      }[];
    }[];
  } = { duration: 0, exactDays: false, options: [] };

  detailsDB.forEach((detail) => {
    if (detail.category_id === 1) {
      if (detail.name.startsWith('DURATION_')) {
        journeyDetails.duration = +detail.name.split('_')[1];
      } else if (detail.name === 'EXACT_DATE') {
        journeyDetails.exactDays = true;
      }
    } else {
      const categoryIndex = journeyDetails.options.findIndex(
        (op) => op.category === detail.category_name,
      );

      if (categoryIndex === -1) {
        journeyDetails.options.push({
          category: detail.category_name,
          types: [
            {
              id: detail.id,
              name: detail.name,
              icon: detail.icon,
              isMultiSelect: detail.is_multi_select,
            },
          ],
        });
      } else {
        journeyDetails.options[categoryIndex].types.push({
          id: detail.id,
          name: detail.name,
          icon: detail.icon,
          isMultiSelect: detail.is_multi_select,
        });
      }
    }
  });

  res.send(journeyDetails);
};
