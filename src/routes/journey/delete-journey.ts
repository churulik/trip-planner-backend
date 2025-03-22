import { Request, Response } from 'express';
import connection from '../../db-connection.js';

const deleteJourney = async (req: Request, res: Response) => {
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

  res.send({ message: 'JOURNEY_DELETED', id });
};

export default deleteJourney;
