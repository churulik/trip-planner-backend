import OpenAI from 'openai';
import { OPENAI_API_KEY } from './constants.js';
import { Request, Response } from 'express';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export const postPlan = async (req: Request, res: Response) => {
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
      model: 'gpt-4o-mini',
    });
    res.send(completion.choices[0].message);
  } catch (e: any) {
    console.error(e.message);
    res.status(400).send({ message: '1234' });
  }
};
