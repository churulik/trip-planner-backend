type User = {
  id: string;
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
