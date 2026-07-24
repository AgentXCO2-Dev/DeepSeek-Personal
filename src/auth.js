import { config } from './config.js';

export function authenticate(req, res, next) {
  const providedPassword = req.headers['x-password'] || req.query.password;

  if (!providedPassword || providedPassword !== config.apiPassword) {
    return res.status(401).json({
      error: '🔒 Unauthorized. Please provide the correct password in the x-password header.',
    });
  }

  next();
}
