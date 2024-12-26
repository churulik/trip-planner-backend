import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { Request, Response } from 'express';
import {
  formatDateTimeForMariaDB,
  setPlanExpirationDate,
  setSessionExpirationDate,
} from '../utils.js';
import connection from '../db-connection.js';

const cryptPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const parseCreditPlanRows = (creditPlanRows: UserCreditPlanDB[]) => {
  const plans: { name: string; credit: number; expiresOn: string }[] = [];
  const journeyDetails: {
    duration: number;
    exactDays: boolean;
    options: [];
  } = { duration: 0, exactDays: false, options: [] };
  if (creditPlanRows.length > 0) {
    const freePlan = creditPlanRows[0];
    const planExpirationDate = setPlanExpirationDate(freePlan.valid_day);
    plans.push({
      name: freePlan.plan_name,
      credit: freePlan.credit,
      expiresOn: planExpirationDate.toISOString(),
    });

    creditPlanRows.forEach((plan) => {
      if (plan.detail_category_id === 1) {
        if (plan.detail_name.startsWith('DURATION_')) {
          journeyDetails.duration = +plan.detail_name.split('_')[1];
        }

        if (plan.detail_name === 'EXACT_DATE') {
          journeyDetails.exactDays = true;
        }
      }
    });
  }

  return {
    plans,
    journeyDetails,
  };
};

const getUserPlans = async (userId: number) => {
  const creditPlanRows = await connection.query<UserCreditPlanDB[]>(`
    select 
        cp.id as plan_id,
        cp.name as plan_name,
        cp.credit as credit,
        cp.valid_day as valid_day,
        cp.price as price,
        jd.id as detail_id,
        jd.name as detail_name,
        jd.icon as detail_icon,
        jc.id as detail_category_id,
        jc.name as detail_category_name
    from user_credit_plan ucp 
        join credit_plan cp on ucp.credit_plan_id = cp.id
        join credit_plan_journey_detail cpjd on cpjd.credit_plan_id = cp.id
        join journey_detail jd on jd.id = cpjd.journey_detail_id
        join journey_category jc on jc.id = jd.category_id
        where ucp.user_id = ${userId} and ucp.expires_on >= '${formatDateTimeForMariaDB()}'
      `);

  return parseCreditPlanRows(creditPlanRows);
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

    const creditPlanRows = await connection.query<UserCreditPlanDB[]>(`
        select cp.id as plan_id,
         cp.name as plan_name,
         cp.credit as credit,
         cp.valid_day as valid_day,
         cp.price as price,
         jd.id as detail_id,
         jd.name as detail_name,
         jd.icon as detail_icon,
         jc.id as detail_category_id,
         jc.name as detail_category_name
      from credit_plan cp
          join credit_plan_journey_detail cpjd on cpjd.credit_plan_id = cp.id
          join journey_detail jd on jd.id = cpjd.journey_detail_id
          join journey_category jc on jc.id = jd.category_id
          where cp.price = 0
      `);

    if (creditPlanRows.length > 0) {
      const freePlan = creditPlanRows[0];
      const planExpirationDate = setPlanExpirationDate(freePlan.valid_day);
      await connection.query(
        `insert into user_credit_plan (user_id, credit_plan_id, created_on, expires_on, credit_left) values ('${insertId}', '${freePlan.plan_id}', '${createdOn}', '${formatDateTimeForMariaDB(planExpirationDate)}', '${freePlan.credit}')`,
      );
    }

    const { plans, journeyDetails } = parseCreditPlanRows(creditPlanRows);

    res.send({
      sessionId,
      expirationDate: expirationDate.toUTCString(),
      plans,
      journeyDetails,
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
  const { plans, journeyDetails } = await getUserPlans(user.id);

  res.send({
    name: user.name,
    email: user.email,
    session: {
      id: sessionId,
      expirationDate: sessionExpirationDate.toUTCString(),
    },
    plans,
    journeyDetails,
  });
};
