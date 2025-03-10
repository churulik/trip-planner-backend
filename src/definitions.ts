export type User = {
  id: number;
  initials: string;
  email: string;
};

export type Journey = {
  id: string;
  journey: string;
  created_on: string;
  iv: string;
  auth_tag: string;
  saved_till: string;
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
  tips?: string[];
};

type DayPlace = {
  id: string;
  name: string;
  markerLabel: string;
  location: { lat: number; lng: number };
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

export type Itinerary = {
  dayTitle: string;
  dayActivities: {
    time: 'Morning' | 'Afternoon' | 'Evening';
    timeActivities: {
      activity: string;
      description: string;
      place: string;
      city: string;
      country: string;
    }[];
  }[];
};

export type OpenAiJourneyResponse = {
  tripTitle: string;
  itinerary: Itinerary[];
  tips: string[];
};

export type GenerateJourneyResponse = {
  tripTitle: string;
  itinerary: {
    dayTitle: string;
    dayActivities: {
      time: string;
      timeActivities: {
        activity: string;
        description: string;
        address: string;
        markerLabel: string;
      }[];
    }[];
    dayPlaces: DayPlace[];
    googleMapsLink: string;
  }[];
  tips?: string[];
};
