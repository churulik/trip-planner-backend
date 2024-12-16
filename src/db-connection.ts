import mariadb from 'mariadb';
import { DB_HOST, DB_NAME, DB_PASSWORD, DB_USER } from './constants.js';

const pool = mariadb.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
});

const connection = await pool.getConnection();

export default connection;
