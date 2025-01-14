import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { Request, Response } from 'express';
import {
  formatDateTimeForMariaDB,
  setPlanExpirationDate,
  setSessionExpirationDate,
} from '../utils.js';
import connection from '../db-connection.js';
import { CreditPlanDB, User } from '../definitions';

const cryptPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const parseCreditPlanRows = (creditPlanRows: CreditPlanDB[]) => {
  const plans: { name: string; credit: number; expiresOn: string }[] = [];
  if (creditPlanRows.length > 0) {
    const freePlan = creditPlanRows[0];
    const planExpirationDate = setPlanExpirationDate(freePlan.valid_day);
    plans.push({
      name: freePlan.name,
      credit: freePlan.credit,
      expiresOn: planExpirationDate.toISOString(),
    });
  }

  return plans;
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

    const { insertId } = await connection.execute(
      'insert into user (email, password, name, created_on) values (?, ?, ?, ?)',
      [req.body.email, encryptedPassword, name, createdOn],
    );

    const sessionId = nanoid();
    await connection.query(
      `insert into login_session (id, expires_on, last_log_in, user_id) values ('${sessionId}', '${formatDateTimeForMariaDB(expirationDate)}', '${createdOn}', '${insertId}')`,
    );

    const creditPlanRows = await connection.query<CreditPlanDB[]>(
      'select * from credit_plan where price = 0',
    );

    if (creditPlanRows.length > 0) {
      const freePlan = creditPlanRows[0];
      const planExpirationDate = setPlanExpirationDate(freePlan.valid_day);
      await connection.query(
        `insert into user_credit_plan (user_id, credit_plan_id, created_on, expires_on, credit_left) values ('${insertId}', '${freePlan.id}', '${createdOn}', '${formatDateTimeForMariaDB(planExpirationDate)}', '${freePlan.credit}')`,
      );
    }

    const plans = parseCreditPlanRows(creditPlanRows);

    res.send({
      sessionId,
      expirationDate: expirationDate.toUTCString(),
      plans,
    });
  } catch (e: any) {
    console.error(e);
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

  const user = req.user as User;
  const creditPlanRows = await connection.query<CreditPlanDB[]>(`
    select cp.*
    from user_credit_plan ucp 
        join credit_plan cp on ucp.credit_plan_id = cp.id
        where ucp.user_id = ${user.id} and ucp.credit_left > 0 and ucp.expires_on >= '${formatDateTimeForMariaDB()}'
      `);

  const plans = parseCreditPlanRows(creditPlanRows);

  res.send({
    name: user.name,
    email: user.email,
    session: {
      id: sessionId,
      expirationDate: sessionExpirationDate.toUTCString(),
    },
    plans,
  });
};
