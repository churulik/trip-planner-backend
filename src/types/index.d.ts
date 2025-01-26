import { User } from '../definitions';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}
