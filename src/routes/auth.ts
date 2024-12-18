import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { Request, Response } from 'express';
import {
  formatDateTimeForMariaDB,
  setSessionExpirationDate,
} from '../utils.js';
import connection from '../db-connection.js';

const cryptPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const signUp = async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();
    const name = (req.body.name || '').trim();

    if (!email || !password || !name) {
      res.status(400).send({ message: 'INVALID_REQUEST' });
      return;
    }

    const encryptedPassword = await cryptPassword(password);
    const createdOn = formatDateTimeForMariaDB();
    const sessionId = nanoid();
    await connection.execute(
      'insert into user (email, password, name, created_on, session_id, session_expires_on, last_log_in) values (?, ?, ?, ?, ?, ?, ?)',
      [
        req.body.email,
        encryptedPassword,
        name,
        createdOn,
        sessionId,
        setSessionExpirationDate(),
        createdOn,
      ],
    );

    res.send({ sessionId });
  } catch (e: any) {
    res.status(400).send(e.message);
  }
};

export const logIn = async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();
    const message = { message: 'INVALID_EMAIL_OR_PASSWORD' };

    if (!email || !password) {
      res.status(400).send(message);
      return;
    }

    const rows = await connection.execute(
      'select * from user where email = ?',
      [email],
    );

    if (!rows.length) {
      res.status(400).send(message);
      return;
    }

    const encryptedPassword = await bcrypt.compare(password, rows[0].password);
    if (!encryptedPassword) {
      res.status(400).send(message);
      return;
    }

    const sessionId = nanoid();
    await connection.query(
      `update user 
       set session_id = '${sessionId}', session_expires_on = '${setSessionExpirationDate()}', last_log_in = '${formatDateTimeForMariaDB()}'
       where email = '${email}'`,
    );

    res.send({ sessionId });
  } catch (e: any) {
    res.status(400).send(e.message);
  }
};

export const logOut = async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization;

  if (sessionId) {
    await connection.query(
      `update user
       set session_expires_on = '${formatDateTimeForMariaDB()}'
       where session_id = '${sessionId}'`,
    );
  }

  res.send({ message: 'OK' });
};

export const forgotPassword = async (req: Request, res: Response) => {
  res.send({ message: 'OK' });
};

export const changePassword = async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization;
  const password = (req.body.password || '').trim();

  if (!sessionId || !password) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  const encryptedPassword = await cryptPassword(password);

  await connection.execute(
    'update user set password = ? where session_id = ?',
    [encryptedPassword, sessionId],
  );

  res.send({ message: 'OK' });
};

export const getUserBySession = async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization;

  await connection.query(
    `update user
       set session_expires_on = '${setSessionExpirationDate()}'
       where session_id = '${sessionId}'`,
  );

  res.send(req.user);
};
