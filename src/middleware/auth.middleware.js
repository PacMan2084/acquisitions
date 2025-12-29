import logger from '#config/logger.js';
import { jwttoken } from '#utils/jwt.js';

// Attach user to the request if a valid JWT is present.
// Does not enforce authentication by itself; controllers can decide whether req.user is required.
export const attachUser = (req, res, next) => {
  try {
    const cookieToken = req.cookies?.token;
    const authHeader = req.get ? req.get('Authorization') : req.headers?.authorization;

    let token = cookieToken;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length).trim();
    }

    if (!token) {
      return next();
    }

    const payload = jwttoken.verify(token);

    if (payload && payload.id) {
      req.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role || 'user',
      };
    }
  } catch (e) {
    // Invalid/expired tokens should not crash the request; log and continue as unauthenticated.
    logger.warn('Invalid or expired auth token', {
      path: req.path,
      method: req.method,
    });
  }

  return next();
};

export default attachUser;
