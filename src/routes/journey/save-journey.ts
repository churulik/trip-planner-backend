import { Request, Response } from 'express';
import connection from '../../db-connection';

const saveJourney = async (req: Request, res: Response) => {
  const { id } = req.body;

  if (!id) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  await connection.query(
    `update journey set saved_till = null where id = '${id}'`,
  );

  res.send({ id, message: 'JOURNEY_PERMANENTLY_SAVED' });
};

export default saveJourney;
