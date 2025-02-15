import express, { json } from 'express';
import {
  changePassword,
  checkRegistered,
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
  getDestinationIcon,
  getDestinationImageUrls,
  insertDest,
  insertVisitor,
} from './routes/destination.js';
import { authMiddleware } from './middlewares.js';
import {
  getDestinationImage,
  getDestinations,
  getJourneyImage,
} from './routes/api';
import { buyCredit, getCreditPlans } from './routes/credit-plans';

const app = express();
const port = 3100;

app.set('trust proxy', true);
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
  next();
});
app.use(json());

app.get('/server', (req, res) => {
  console.log('server', req.ip);
  res.send(req.ip);
});
app.post('/server/check-registered', checkRegistered);
app.post('/server/sign-up', signUp);
app.post('/server/log-in', logIn);
app.post('/server/log-out', logOut);
app.post('/server/forgot-password', forgotPassword);
app.post('/server/change-password', changePassword);
app.get('/server/user', authMiddleware, getUserBySession);

app.get('/server/translations', getTranslation);
app.get('/server/languages', getLanguages);

app.post('/server/journey', authMiddleware, generateJourney);
app.get('/server/user-journey', authMiddleware, getJourneys);
app.post('/server/user-journey', authMiddleware, saveJourney);
app.delete('/server/user-journey/:id', authMiddleware, deleteJourney);
app.get('/server/journey-details', journeyDetail);

app.get('/server/image/destination/url/:id', getDestinationImageUrls);
app.get('/server/image/destination/:url', getDestinationImage);
app.post('/server/ins-dest', insertDest);

app.get('/server/credit-plans', getCreditPlans);
app.post('/server/buy-credit', authMiddleware, buyCredit);

app.get('/client/destinations', getDestinations);
app.get('/client/image/journey/:name', getJourneyImage);
app.get('/client/icon/destination/:name', getDestinationIcon);
app.get('/client/visitor', insertVisitor);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
