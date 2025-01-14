export type User = {
  id: number;
  name: string;
  email: string;
};

export type Journey = {
  id: string;
  journey: string;
  created_on: string;
  iv: string;
  auth_tag: string;
};

export type AiJourneyResponse = {
  tripTitle: string;
  city: { lat: number; lng: number };
  itinerary: [
    {
      dayTitle: string;
      dayActivities: [
        {
          time: 'Morning | Afternoon | Evening';
          timeActivities: [
            {
              activity: string;
              description: string;
              place: {
                name: string;
                address: string;
                city: string;
                country: string;
              };
            },
          ];
        },
      ];
    },
  ];
  tips: string[];
};

export type CreditPlanDB = {
  id: string;
  name: string;
  credit: number;
  valid_day: number;
  price: number;
};

export type UserCreditPlanDB = {
  plan_id: string;
  plan_name: string;
  credit: number;
  valid_day: number;
  price: number;
  detail_id: string;
  detail_name: string;
  detail_icon: string;
  detail_category_id: number;
  detail_category_name: string;
};
