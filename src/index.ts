import express, { json } from 'express';
import {
  changePassword,
  forgotPassword,
  getUserBySession,
  logIn,
  logOut,
  signUp,
} from './routes/auth.js';
import { getLanguages, getTranslation } from './routes/translation.js';
import {
  deleteJourney,
  generateJourney,
  getJourneys,
  journeyDetail,
  saveJourney,
} from './routes/journey.js';
import {
  getDestinationImageUrls,
  insertDest,
  getDestinationIcon,
} from './routes/destination.js';
import { authMiddleware } from './middlewares.js';
import {
  getDestinationImage,
  getDestinations,
  getJourneyImage,
} from './routes/api';
import { getCreditPlans } from './routes/credit-plans';

const app = express();
const port = 3100;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
  next();
});
app.use(json());

app.post('/sign-up', signUp);
app.post('/log-in', logIn);
app.post('/log-out', logOut);
app.post('/forgot-password', forgotPassword);
app.post('/change-password', changePassword);
app.get('/user', authMiddleware, getUserBySession);

app.get('/translations', getTranslation);
app.get('/languages', getLanguages);

app.post('/journey', authMiddleware, generateJourney);
app.get('/user-journey', authMiddleware, getJourneys);
app.post('/user-journey', authMiddleware, saveJourney);
app.delete('/user-journey/:id', authMiddleware, deleteJourney);
app.get('/journey-details', journeyDetail);

app.get('/image/destination/url/:id', getDestinationImageUrls);
app.get('/image/destination/:url', getDestinationImage);
app.post('/ins-dest', insertDest);

app.get('/api/destinations', getDestinations);
app.get('/api/image/journey/:name', getJourneyImage);
app.get('/api/icon/destination/:name', getDestinationIcon);

app.get('/credit-plans', getCreditPlans);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
