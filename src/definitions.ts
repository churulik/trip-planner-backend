type User = {
  id: number;
  name: string;
  email: string;
};

type Journey = {
  id: string;
  journey: string;
  created_on: string;
  iv: string;
  auth_tag: string;
};

type JourneyResponse = {
  tripTitle: string;
  city: {
    lat: number;
    lng: number;
  };
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
                // postalCode: number;
                // lat: number;
                // lng: number;
                address: string;
              };
            },
          ];
        },
      ];
    },
  ];
  tips: string[];
};

type UserCreditPlanDB = {
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
