import express, { type Express } from 'express';
import {
  apiErrorHandler,
  createCorsMiddleware,
  createSecurityHeadersMiddleware,
  generalApiLimiter,
} from './middleware/security.js';
import { createApiRouter } from './routes/index.js';

export function createApiApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(createSecurityHeadersMiddleware());
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: '6mb' }));
  app.use('/api', generalApiLimiter, createApiRouter());
  app.use('/api', apiErrorHandler);

  return app;
}
