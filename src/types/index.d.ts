import { User } from '../definitions.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
