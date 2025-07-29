import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { config, validateConfig } from './config';
import routes from './routes';
import logger from './logger';
import {
  requestLoggerMiddleware,
  errorHandlerMiddleware,
  validateJsonMiddleware,
  validateRequestSizeMiddleware,
  rateLimitMiddleware
} from './middleware';

async function startServer() {
  try {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Validate configuration
    validateConfig();
    logger.info('Configuration validated successfully');

    // Create Express app
    const app = express();

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
        },
      },
    }));

    // CORS configuration
    app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      credentials: false
    }));

    // Request parsing middleware
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Custom middleware
    app.use(requestLoggerMiddleware);
    app.use(validateJsonMiddleware);
    app.use(validateRequestSizeMiddleware);
    app.use(rateLimitMiddleware(15 * 60 * 1000, 100)); // 100 requests per 15 minutes

    // Routes
    app.use('/', routes);

    // 404 handler (must be before error handler)
    app.use('*', (req, res) => {
      logger.warn(`404 - Endpoint not found: ${req.method} ${req.originalUrl}`, {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip
      });
      
      res.status(404).json({
        success: false,
        error: {
          code: 'ENDPOINT_NOT_FOUND',
          message: 'Endpoint not found',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Error handling middleware (must be last)
    app.use(errorHandlerMiddleware);

    // Start server
    const port = config.port;
    const server = app.listen(port, () => {
      logger.info('K1 Starknet Adapter server started', {
        port,
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
          health: `http://localhost:${port}/health`,
          atomicSwap: `http://localhost:${port}/api/atomic-swap`,
          invoice: `http://localhost:${port}/api/invoice`,
          balance: `http://localhost:${port}/balance/:address`
        }
      });
    });

    // Graceful shutdown handlers
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connections, cleanup resources, etc.
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Error starting server', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  process.exit(1);
});