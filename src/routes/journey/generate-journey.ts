import { Request, Response } from 'express';
import connection from '../../db-connection';
import {
  GenerateJourneyResponse,
  OpenAiJourneyResponse,
} from '../../definitions';
import {
  formatDateTimeForMariaDB,
  setJourneyAvailableTillDate,
} from '../../utils';
import OpenAI from 'openai';
import {
  CRYPTO_ALGORITHM,
  GOOGLE_PLACES_API_KEY,
  OPENAI_API_KEY,
  USER_JOURNEY_CRYPTO_SECRET_KEY,
} from '../../constants';
import crypto from 'crypto';
import { nanoid } from 'nanoid';
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

const schema = {
  tripTitle: true,
  itinerary: [
    {
      dayTitle: true,
      welcoming: { optional: true },
      dayActivities: [
        {
          time: true,
          timeActivities: [
            {
              activity: true,
              description: true,
              place: true,
              city: true,
              country: true,
            },
          ],
        },
      ],
    },
  ],
  tips: { optional: true },
};

const validateJson = (json: any, schema: any): boolean => {
  if (typeof schema === 'boolean') return true;

  if (Array.isArray(schema)) {
    if (!Array.isArray(json)) return false;
    return json.every((item) => validateJson(item, schema[0]));
  }

  if (typeof schema === 'object') {
    if (typeof json !== 'object' || json === null) return false;
    return Object.keys(schema).every((key) => {
      if (schema[key]?.optional) return true; // Skip optional fields
      return key in json && validateJson(json[key], schema[key]);
    });
  }

  return true;
};

const insertJourney = async (
  userId: number,
  journey: GenerateJourneyResponse,
) => {
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
  const id = nanoid();
  const createdOn = formatDateTimeForMariaDB();
  const savedTill = formatDateTimeForMariaDB(setJourneyAvailableTillDate());
  await connection.execute(
    'insert into journey (id, user_id, journey, created_on, iv, auth_tag, saved_till) values(?, ?, ?, ? ,?, ?, ?)',
    [
      id,
      userId,
      encryptedJourney,
      createdOn,
      ivBase64,
      authTagBase64,
      savedTill,
    ],
  );

  return { id, createdOn, journey, savedTill };
};

const addPlacesAddress = async (journey: OpenAiJourneyResponse) => {
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
            `${timeActivity.place}, ${timeActivity.city}, ${timeActivity.country}`
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

const generateJourney = async (req: Request, res: Response) => {
  const { cityId, details } = req.body;

  if (
    !cityId ||
    !details ||
    !details.duration ||
    !details.duration.value ||
    (details.optionals && !Array.isArray(details.optionals))
  ) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  const [destination] = await connection.execute<
    { en: string; query_count: number; iso2: string }[]
  >('select en, query_count, iso2 from destination where id = ?', [cityId]);

  if (!destination) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  let detailsForAi = '';

  if (details.optionals?.length) {
    const placeholders = details.optionals.map(() => '?').join(',');

    const dbDetails = await connection.execute<{ ai_text: string }[]>(
      `select ai_text from journey_detail where id in (${placeholders}) order by category_id`,
      details.optionals,
    );
    detailsForAi = dbDetails.map(({ ai_text }) => ai_text).join(' ');
  }

  const returnError = () => {
    res.status(503).send({ message: 'GENERATE_JOURNEY_ERROR' });
  };

  let aiGeneratedJourney: OpenAiJourneyResponse | null = null;

  try {
    const format =
      '{tripTitle:string;itinerary:{dayTitle:string;welcoming:string;dayActivities:{time:‘Morning’|‘Afternoon’|‘Evening’;timeActivities:{activity:string;description:string;place:string;city:string;country:string}[]}[]}[];tips:string[];}';
    const content = `Generate a ${details.duration.value}-day trip to ${destination.en}. ${detailsForAi} Use the following JSON format strictly: ${format}. Output as plain string, without beautifiers, ensuring all keys and string values are wrapped in double quotes and no trailing commas are present, ready for JSON parsing.`;
    console.log(content);
    const data = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      store: false,
      messages: [{ role: 'user', content }],
      user: req.user!.id.toString(),
    });

    if (data.choices?.length && data.choices[0].message.content) {
      const responseContent = data.choices[0].message.content;
      const { created, model, usage } = data;

      await connection.execute(
        'insert into ai_response (input, content, created, model, total_tokens) values(?, ?, ?, ?, ?)',
        [content, responseContent, created, model, usage?.total_tokens || 0],
      );

      try {
        aiGeneratedJourney = JSON.parse(
          responseContent,
        ) as OpenAiJourneyResponse;

        if (!validateJson(aiGeneratedJourney, schema)) {
          console.error('FIELDS_NOT_VALID');
          returnError();
          return;
        }
      } catch (error: any) {
        console.error('PARSE_ERROR', error.message);
        await connection.execute(
          'insert into ai_error_log (req, res, user_id, created_on, type) values(?, ?, ?, ?, ?)',
          [
            destination.en,
            error.message,
            req.user!.id,
            formatDateTimeForMariaDB(),
            'PARSE_ERROR',
          ],
        );
        returnError();
        return;
      }
    } else {
      console.error('NO_AI_RESPONSE_CONTENT');
      returnError();
      return;
    }
  } catch (error: any) {
    console.error('AI_ERROR', error.message);
    await connection.execute(
      'insert into ai_error_log (req, res, user_id, created_on, type) values(?, ?, ?, ?, ?)',
      [
        destination.en,
        error.message,
        req.user!.id,
        formatDateTimeForMariaDB(),
        'AI_ERROR',
      ],
    );
    returnError();
    return;
  }

  try {
    const places = await addPlacesAddress(aiGeneratedJourney);

    const itinerary = aiGeneratedJourney.itinerary.map((itinerary) => {
      const dayPlaces: {
        id: string;
        name: string;
        markerLabel: string;
        location: { lat: number; lng: number };
      }[] = [];
      let activityNumber = 0;

      const dayActivities = itinerary.dayActivities.map((dayActivity) => {
        const timeActivities = dayActivity.timeActivities.map(
          (timeActivity) => {
            const placeAddress =
              places[
                `${timeActivity.place}, ${timeActivity.city}, ${timeActivity.country}`
              ];

            const markerLabel = MAP_MARKER_LETTER[activityNumber++];

            if (placeAddress) {
              dayPlaces.push({
                id: placeAddress.id,
                name: placeAddress.name,
                markerLabel,
                location: placeAddress.location,
              });
            }

            return {
              activity: timeActivity.activity,
              description: timeActivity.description,
              address: timeActivity.place,
              markerLabel,
            };
          },
        );

        return { ...dayActivity, timeActivities };
      });

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
      ...aiGeneratedJourney,
      icon: destination.iso2.toLowerCase(),
      itinerary,
    };

    const output = await insertJourney(req.user!.id, journeyToDb);

    await connection.query(
      `update destination set query_count = destination.query_count + 1 where id = '${cityId}'`,
    );

    res.send(output);
  } catch (e: any) {
    console.error('GENERAL_ERROR', e.message);
    returnError();
  }
};

export default generateJourney;
