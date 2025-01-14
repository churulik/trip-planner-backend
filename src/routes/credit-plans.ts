import { Request, Response } from 'express';
import connection from '../db-connection';

export const getCreditPlans = async (_: Request, res: Response) => {
  const rows = await connection.query<
    {
      id: string;
      name: string;
      credit: number;
      valid_day: number;
      price: number;
    }[]
  >('select * from credit_plan where price > 0 order by price', []);

  console.log(rows);
  res.send(rows);
};
