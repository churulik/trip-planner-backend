import formData from 'form-data';
import { MAILGUN_API_KEY } from './constants.js';
import Mailgun from 'mailgun.js';

// @ts-ignore
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: 'api',
  key: MAILGUN_API_KEY as string,
});

mg.messages
  .create('sandbox-123.mailgun.org', {
    from: 'Excited User <mailgun@sandbox25961ab781cd4106aab1b40b59427d4a.mailgun.org>',
    to: ['tvelchev@yahoo.com'],
    subject: 'Hello',
    text: 'Testing some Mailgun awesomeness!',
    html: '<h1>Testing some Mailgun awesomeness!</h1>',
  })
  .then((msg: any) => console.log(msg)) // logs response data
  .catch((err: any) => console.log(err)); // logs any error
