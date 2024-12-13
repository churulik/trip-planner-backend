import express, { json } from 'express';
import {
  changePassword,
  forgotPassword,
  getUserBySession,
  logIn,
  logOut,
  signUp,
} from './auth.js';
import { getLanguages, getTranslation } from './getTranslation.js';
import { postPlan } from './postPlan.js';
import { getDestinations, getDestinationImage } from './destination.js';

const app = express();
const port = 3100;

app.use(json());

app.post('/sign-up', signUp);
app.post('/log-in', logIn);
app.post('/log-out', logOut);
app.post('/forgot-password', forgotPassword);
app.post('/change-password', changePassword);
app.post('/user', getUserBySession);

app.get('/translations', getTranslation);
app.get('/languages', getLanguages);

app.post('/plan', postPlan);

app.get('/destinations', getDestinations);
app.get('/destination-image/:id', getDestinationImage);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
