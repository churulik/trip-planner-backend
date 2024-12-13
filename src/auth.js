import bcrypt from 'bcrypt';
import { formatDateTimeToMysql, setSessionExpirationDate } from './utils.js';
import { nanoid } from 'nanoid';
import connection from './db-connection.js';

const cryptPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const signUp = async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();
    const name = (req.body.name || '').trim();

    if (!email || !password || !name) {
      return res.status(400).send({ message: 'INVALID_REQUEST' });
    }

    const encryptedPassword = await cryptPassword(password);
    const createdOn = formatDateTimeToMysql();
    const sessionId = nanoid();
    await connection.execute(
      'insert into user (email, password, name, created_on, web_session_id, web_session_expires_on, last_log_in) values (?, ?, ?, ?, ?, ?, ?)',
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
  } catch (e) {
    console.error(e);
    res.status(400).send(e.message);
  }
};

export const logIn = async (req, res) => {
  try {
    const email = (req.body.email || '').trim();
    const password = (req.body.password || '').trim();
    const message = { message: 'INVALID_EMAIL_OR_PASSWORD' };

    if (!email || !password) {
      return res.status(400).send(message);
    }

    const rows = await connection.execute(
      'select * from user where email = ?',
      [email],
    );

    if (!rows.length) {
      return res.status(400).send(message);
    }

    const encryptedPassword = await bcrypt.compare(password, rows[0].password);
    if (!encryptedPassword) {
      return res.status(400).send(message);
    }

    const sessionId = nanoid();
    await connection.query(
      `update user 
       set web_session_id = '${sessionId}', web_session_expires_on = '${setSessionExpirationDate()}', last_log_in = '${formatDateTimeToMysql()}'
       where email = '${email}'`,
    );

    res.send({ sessionId });
  } catch (e) {
    res.status(400).send(e.message);
  }
};

export const logOut = async (req, res) => {
  const sessionId = req.headers.authorization;

  if (sessionId) {
    await connection.query(
      `update user
       set web_session_expires_on = '${formatDateTimeToMysql()}'
       where web_session_id = '${sessionId}'`,
    );
  }

  res.send({ message: 'OK' });
};

export const forgotPassword = async (req, res) => {
  res.send({ message: 'OK' });
};

export const changePassword = async (req, res) => {
  const sessionId = req.headers.authorization;
  const password = (req.body.password || '').trim();

  if (!sessionId || !password) {
    return res.status(400).send({ message: 'INVALID_REQUEST' });
  }

  const encryptedPassword = await cryptPassword(password);

  await connection.execute(
    'update user set password = ? where web_session_id = ?',
    [encryptedPassword, sessionId],
  );

  res.send({ message: 'OK' });
};

export const getUserBySession = async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).send('INVALID_REQUEST');
  }

  const rows = await connection.execute(
    `select name, email from user where web_session_id = ? and web_session_expires_on > ?`,
    [sessionId, formatDateTimeToMysql()],
  );

  if (!rows.length) {
    return res.status(401);
  }

  await connection.query(
    `update user
       set web_session_expires_on = '${setSessionExpirationDate()}'
       where web_session_id = '${sessionId}'`,
  );

  console.log(rows[0]);
  res.send(rows[0]);
};
