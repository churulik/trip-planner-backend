import { NextFunction, Request, Response } from 'express';
import connection from './db-connection.js';
import { formatDateTimeForMariaDB } from './utils.js';
import { User } from './definitions';

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const sessionId = req.headers.authorization;

  if (!sessionId) {
    res.status(401).send({ message: 'UNAUTHORIZED' });
    return;
  }

  const rows = await connection.execute<User[]>(
    `select u.id, u.name, u.email from user u join login_session ls on u.id = ls.user_id where ls.id = ? and ls.expires_on > ?`,
    [sessionId, formatDateTimeForMariaDB()],
  );

  if (!rows.length) {
    res.status(401).send({ message: 'UNAUTHORIZED' });
    return;
  }

  req.user = rows[0];

  next();
};
