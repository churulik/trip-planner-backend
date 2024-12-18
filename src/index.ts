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
  getJourney,
  getJourneys,
  saveJourney,
} from './routes/journey.js';
import { getDestinations, getDestinationImage } from './routes/destination.js';
import { authMiddleware } from './middlewares.js';

const app = express();
const port = 3100;

app.use(json());

app.post('/sign-up', signUp);
app.post('/log-in', logIn);
app.post('/log-out', logOut);
app.post('/forgot-password', forgotPassword);
app.post('/change-password', changePassword);
app.post('/user', authMiddleware, getUserBySession);

app.get('/translations', getTranslation);
app.get('/languages', getLanguages);

app.post('/journey', getJourney);

app.get('/user-journey', authMiddleware, getJourneys);
app.post('/user-journey', authMiddleware, saveJourney);
app.delete('/user-journey/:id', authMiddleware, deleteJourney);

app.get('/destinations', getDestinations);
app.get('/destination-image/:id', getDestinationImage);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
