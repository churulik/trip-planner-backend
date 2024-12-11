import OpenAI from 'openai';
import { OPENAI_API_KEY } from './constants.js';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export const plan = async (req, res) => {
  const completion = await openai.chat.completions.create({
    messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
    model: 'gpt-4o-mini',
  });

  console.log(completion.choices[0]);
  res.send(completion.choices[0].message);
};
