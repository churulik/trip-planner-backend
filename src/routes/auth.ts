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
    const expirationDate = setSessionExpirationDate();

    const result = await connection.execute(
      'insert into user (email, password, name, created_on) values (?, ?, ?, ?)',
      [req.body.email, encryptedPassword, name, createdOn],
    );
    const sessionId = nanoid();
    await connection.query(
      `insert into login_session (id, expires_on, last_log_in, user_id) values ('${sessionId}', '${formatDateTimeForMariaDB(expirationDate)}', '${createdOn}', '${result.insertId}')`,
    );

    console.log(result);
    res.send({ sessionId, expirationDate: expirationDate.toUTCString() });
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

    const rows = await connection.execute<{ id: number; password: string }[]>(
      'select * from user where email = ?',
      [email],
    );

    if (!rows.length) {
      res.status(400).send(message);
      return;
    }

    const user = rows[0];

    const encryptedPassword = await bcrypt.compare(password, user.password);
    if (!encryptedPassword) {
      res.status(400).send(message);
      return;
    }

    const sessionId = nanoid();
    const expirationDate = setSessionExpirationDate();
    await connection.query(
      `insert into login_session (id, expires_on, last_log_in, user_id) values ('${sessionId}', '${formatDateTimeForMariaDB(expirationDate)}', '${formatDateTimeForMariaDB()}', '${user.id}')`,
    );

    res.send({ sessionId, expirationDate: expirationDate.toUTCString() });
  } catch (e: any) {
    res.status(400).send(e.message);
  }
};

export const logOut = async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization;

  if (sessionId) {
    await connection.query(
      `delete from login_session where id = '${sessionId}'`,
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
    'update user u join login_session ls on (u.id = ls.user_id) set password = ? where ls.id = ?',
    [encryptedPassword, sessionId],
  );

  res.send({ message: 'OK' });
};

export const getUserBySession = async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization;
  const sessionExpirationDate = setSessionExpirationDate();
  await connection.query(
    `update login_session
       set expires_on = '${formatDateTimeForMariaDB(sessionExpirationDate)}'
       where id = '${sessionId}'`,
  );

  res.send({
    ...req.user,
    session: {
      id: sessionId,
      expirationDate: sessionExpirationDate.toUTCString(),
    },
  });
};
