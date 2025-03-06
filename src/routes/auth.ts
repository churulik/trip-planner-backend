import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { Request, Response } from 'express';
import {
  formatDateTimeForMariaDB,
  getUserCredits,
  setPlanExpirationDate,
  setSessionExpirationDate,
} from '../utils.js';
import connection from '../db-connection.js';
import { CreditPlanDB, Journey, User } from '../definitions';
import {
  EMAIL_REGEX,
  PASSWORD_REGEX,
  USER_JOURNEY_CRYPTO_SECRET_KEY,
} from '../constants';
import crypto from 'crypto';

type Plan = { name: string; credit: number; expiresOn: string };
type UserJourney = { id: string; journey: Journey; createdOn: string };

const cryptPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const getUserCreditPlans = async (userId: number) => {
  const creditPlanRows = await connection.query<CreditPlanDB[]>(`
    select cp.*
    from user_credit_plan ucp 
        join credit_plan cp on ucp.credit_plan_id = cp.id
        where ucp.user_id = ${userId} and ucp.credit_left > 0 and ucp.expires_on >= '${formatDateTimeForMariaDB()}'
      `);

  const plans: Plan[] = [];
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

const getUserJourneys = async (userId: number) => {
  const dbUserJourneys = await connection.query<Journey[]>(
    `select * from journey where user_id = ${userId} order by created_on desc`,
  );

  const key = Buffer.from(USER_JOURNEY_CRYPTO_SECRET_KEY, 'base64');
  return dbUserJourneys.map(
    ({ id, journey, iv, auth_tag, created_on, saved_till }) => {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
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
        savedTill: saved_till,
      } as UserJourney;
    },
  );
};

const buildUserResponse = (
  userInitials: string,
  userEmail: string,
  sessionId: string,
  sessionExpirationDate: Date,
  credits: number,
  plans: Plan[],
  journeys: UserJourney[] = [],
) => ({
  initials: userInitials,
  email: userEmail,
  session: {
    id: sessionId,
    expirationDate: sessionExpirationDate.toUTCString(),
  },
  plans,
  journeys,
  credits,
});

export const checkRegistered = async (req: Request, res: Response) => {
  const email = (req.body.email || '').trim();

  if (!email) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  const [row] = await connection.execute<{ count: number }[]>(
    'select count(*) as count from user where email = ?',
    [email],
  );

  res.send({ isRegistered: row.count > 0 });
};

export const signUp = async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();
    const initials = (req.body.initials || '').trim();

    if (
      !email ||
      !new RegExp(EMAIL_REGEX).test(email) ||
      !password ||
      !new RegExp(PASSWORD_REGEX).test(password) ||
      !initials ||
      initials.length > 2
    ) {
      res.status(400).send({ message: 'INVALID_REQUEST' });
      return;
    }

    const encryptedPassword = await cryptPassword(password);
    const createdOn = formatDateTimeForMariaDB();
    const expirationDate = setSessionExpirationDate();

    const { insertId } = await connection.execute(
      'insert into user (email, password, initials, created_on) values (?, ?, ?, ?)',
      [req.body.email, encryptedPassword, initials, createdOn],
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

    const plans = await getUserCreditPlans(insertId);

    res.send(
      buildUserResponse(initials, email, sessionId, expirationDate, 1, plans),
    );
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

    const rows = await connection.execute<
      { id: number; password: string; initials: string; email: string }[]
    >('select * from user where email = ?', [email]);

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

    const plans = await getUserCreditPlans(user.id);
    const journeys = await getUserJourneys(user.id);
    const credits = await getUserCredits(user.id);

    res.send(
      buildUserResponse(
        user.initials,
        user.email,
        sessionId,
        expirationDate,
        credits,
        plans,
        journeys,
      ),
    );
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

export const forgotPassword = async (_: Request, res: Response) => {
  res.send({ message: 'OK' });
};

export const changePassword = async (req: Request, res: Response) => {
  const password = (req.body.password || '').trim();

  if (!password || password.length > 32) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  const encryptedPassword = await cryptPassword(password);

  await connection.execute('update user u set password = ? where id = ?', [
    encryptedPassword,
    req.user!.id,
  ]);

  res.send({ message: 'OK' });
};

export const getUserBySession = async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization as string;
  const sessionExpirationDate = setSessionExpirationDate();
  await connection.query(
    `update login_session
       set expires_on = '${formatDateTimeForMariaDB(sessionExpirationDate)}'
       where id = '${sessionId}'`,
  );

  const user = req.user as User;
  const plans = await getUserCreditPlans(user.id);
  const journeys = await getUserJourneys(user.id);
  const credits = await getUserCredits(req.user!.id);

  res.send(
    buildUserResponse(
      user.initials,
      user.email,
      sessionId,
      sessionExpirationDate,
      credits,
      plans,
      journeys,
    ),
  );
};

export const updateUser = async (req: Request, res: Response) => {
  const user = req.user!;
  const initials = (req.body.initials || '').trim();

  if (!initials || initials.length > 2) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  await connection.execute('update user set initials = ? where id = ?', [
    initials,
    user.id,
  ]);

  res.send({ message: 'UPDATED' });
};

export const getProfileValidations = async (_: Request, res: Response) => {
  res.send({
    email: {
      regex: EMAIL_REGEX,
      message: 'INVALID_EMAIL_INPUT',
    },
    password: {
      min: 8,
      max: 64,
      policy: [
        { name: 'upper', regex: '[A-Z]' },
        { name: 'lower', regex: '[a-z]' },
        { name: 'digit', regex: '\d' },
        { name: 'special', regex: "[!#$%&'*+/=?^_`{|}~.-]" },
      ],
      message: 'INVALID_PASSWORD_INPUT',
    },
    initials: {
      max: 2,
      message: 'INVALID_INITIALS_INPUT',
    },
  });
};
