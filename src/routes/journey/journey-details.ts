import { Request, Response } from 'express';
import connection from '../../db-connection.js';

const journeyDetails = async (req: Request, res: Response) => {
  const sessionId = req.headers.authorization;

  let planId = '';
  if (!sessionId) {
    const [freePlan] = await connection.query<{ id: string }[]>(
      'select id from credit_plan where price = 0',
    );
    planId = freePlan.id;
  }

  const detailsDB = await connection.query<
    {
      id: string;
      name: string;
      icon: string;
      category_id: number;
      category_name: string;
      is_multi_select: boolean;
    }[]
  >(`
    select jd.*, jc.name as category_name, jc.is_multi_select
        from  journey_detail jd
        join journey_category jc on jc.id = jd.category_id
    where not exists (
        select 1
        from credit_plan_journey_detail_exclusion cpjd
        where cpjd.journey_detail_id = jd.id
          and cpjd.credit_plan_id = '${planId}'
    )
    order by category_id, \`order\`
  `);

  const journeyDetails: {
    duration: number;
    exactDays: boolean;
    options: {
      category: string;
      types: {
        id: string;
        name: string;
        icon: string;
        svg?: string;
        isMultiSelect: boolean;
      }[];
    }[];
  } = { duration: 0, exactDays: false, options: [] };

  detailsDB.forEach((detail) => {
    if (detail.category_id === 1) {
      if (detail.name.startsWith('DURATION_')) {
        journeyDetails.duration = +detail.name.split('_')[1];
      } else if (detail.name === 'EXACT_DATE') {
        journeyDetails.exactDays = true;
      }
    } else {
      const categoryIndex = journeyDetails.options.findIndex(
        (op) => op.category === detail.category_name,
      );

      if (categoryIndex === -1) {
        journeyDetails.options.push({
          category: detail.category_name,
          types: [
            {
              id: detail.id,
              name: detail.name,
              icon: detail.icon,
              isMultiSelect: detail.is_multi_select,
            },
          ],
        });
      } else {
        journeyDetails.options[categoryIndex].types.push({
          id: detail.id,
          name: detail.name,
          icon: detail.icon,
          isMultiSelect: detail.is_multi_select,
        });
      }
    }
  });

  res.send(journeyDetails);
};

export default journeyDetails;
