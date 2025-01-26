import { Request, Response } from 'express';
import connection from '../db-connection';
import { formatDateTimeForMariaDB } from '../utils';

interface CreditPlanBase {
  id: string;
  name: string;
  credit: number;
  validDay: number;
  price: number;
}

interface CreditPlanDb extends CreditPlanBase {
  incentives?: string;
}

interface CreditPlanMapped extends CreditPlanBase {
  incentives: string[];
}

export const getCreditPlans = async (_: Request, res: Response) => {
  const rows = await connection.query<CreditPlanDb[]>(
    `select cp.*, cp.valid_day as validDay, GROUP_CONCAT(pi.value order by pi.id) as incentives from credit_plan cp
        left join credit_plan_plan_incentive cppi on cp.id = cppi.credit_plan_id
        left join plan_incentive pi on cppi.plan_incentive_id = pi.id
        where cp.price > 0 group by cp.price order by cp.price
    `,
  );

  const mappedRows: CreditPlanMapped[] = rows.map((row) => ({
    ...row,
    incentives: row.incentives?.split(',') || [],
  }));

  res.send(mappedRows);
};

export const buyCredit = async (req: Request, res: Response) => {
  const { planId } = req.body;

  if (!planId) {
    res.status(400).send({ message: 'INVALID_REQUEST' });
    return;
  }

  await connection.query(
    `insert into purchase_interest (user_id, plan_id, created_on) values (${req.user!.id}, '${planId}', '${formatDateTimeForMariaDB()}')`,
  );

  res.status(503).send({ message: 'PAYMENTS_TEMPORALLY_UNAVAILABLE' });
};
