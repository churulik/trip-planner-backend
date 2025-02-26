import dotenv from 'dotenv';

dotenv.config();

export const DB_HOST = process.env.DB_HOST as string;
export const DB_USER = process.env.DB_USER as string;
export const DB_PASSWORD = process.env.DB_PASSWORD as string;
export const DB_NAME = process.env.DB_NAME as string;

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
export const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY as string;
export const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY as string;

export const USER_JOURNEY_CRYPTO_SECRET_KEY = process.env
  .USER_JOURNEY_CRYPTO_SECRET_KEY as string;

export const GOOGLE_PLACES_API_KEY = process.env
  .GOOGLE_PLACES_API_KEY as string;

export const CRYPTO_ALGORITHM = 'aes-256-gcm';
