import express, { json } from 'express';
import {
  changePassword,
  forgotPassword,
  logIn,
  logOut,
  signUp,
} from './auth.js';
import { languages, translation } from './translation.js';
import { plan } from './plan.js';
import { cities, citiesIns, getCityImage } from './city.js';

const app = express();
const port = 3100;

app.use(json());

app.post('/sign-up', signUp);
app.post('/log-in', logIn);
app.post('/log-out', logOut);
app.post('/forgot-password', forgotPassword);
app.post('/change-password', changePassword);

app.get('/translations', translation);
app.get('/languages', languages);

app.post('/plan', plan);
app.get('/cities', cities);
app.get('/cities-ins', citiesIns);
app.get('/city-image', getCityImage);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
