import { config } from './config.js';

/**
 * Authentication middleware for Express.
 * Checks the password from the request (header or query) against the allowed list.
 * If the list is empty, NO password will be accepted.
 */
export function authenticate(req, res, next) {
  // Password can be sent in the 'x-password' header (preferred) or as a query param
  const providedPassword = req.headers['x-password'] || req.query.password;

  // If no password is provided at all
  if (!providedPassword) {
    return res.status(401).json({
      error: '🔒 Unauthorized. Please provide a password in the x-password header.',
    });
  }

  // If no passwords are configured in environment, reject all
  if (config.apiPasswords.length === 0) {
    return res.status(401).json({
      error: '🔒 Unauthorized. No passwords configured on the server.',
    });
  }

  // Check if the provided password matches ANY of the allowed passwords
  const isValid = config.apiPasswords.includes(providedPassword);

  if (!isValid) {
    return res.status(401).json({
      error: '🔒 Unauthorized. Invalid password.',
    });
  }

  // Password is correct – proceed to the next handler
  next();
}
