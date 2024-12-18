import { NextFunction, Request, Response } from 'express';
import connection from './db-connection.js';
import { formatDateTimeForMariaDB } from './utils.js';

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
    `select id, name, email from user where session_id = ? and session_expires_on > ?`,
    [sessionId, formatDateTimeForMariaDB()],
  );

  if (!rows.length) {
    res.status(401).send({ message: 'UNAUTHORIZED' });
    return;
  }

  req.user = rows[0];

  next();
};
