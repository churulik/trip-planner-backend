import dotenv from 'dotenv';
dotenv.config();

export const DB_HOST = process.env.DB_HOST;
export const DB_USER = process.env.DB_USER;
export const DB_PASSWORD = process.env.DB_PASSWORD;
export const DB_NAME = process.env.DB_NAME;

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
export const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
