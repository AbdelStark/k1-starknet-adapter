/**
 * K1 Starknet Adapter - Main Server Entry Point
 * 
 * This is the main server file that sets up the Express application with:
 * - Production-grade middleware stack
 * - Structured logging with Winston
 * - Request validation and security headers
 * - Rate limiting and error handling
 * - Graceful shutdown handling
 * 
 * The server provides REST API endpoints for atomic swaps between
 * Starknet and Bitcoin Lightning Network.
 * 
 * @author K1 Team
 * @version 1.0.0
 */

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

/**
 * Initialize and start the Express server with all middleware and routes
 * Handles the complete server lifecycle including graceful shutdown
 */
async function startServer() {
  try {
    // Ensure logs directory exists for file-based logging
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Validate configuration before starting server
    // This ensures all required environment variables are present
    validateConfig();
    logger.info('Configuration validated successfully');

    // Create Express application instance
    const app = express();

    // Security middleware - Helmet provides various security headers
    // Content Security Policy prevents XSS attacks by controlling resource loading
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],                    // Only allow resources from same origin
          styleSrc: ["'self'", "'unsafe-inline'"],  // Allow inline styles for API responses
          scriptSrc: ["'self'"],                    // Only allow scripts from same origin
          connectSrc: ["'self'"],                   // Only allow connections to same origin
        },
      },
    }));

    // CORS (Cross-Origin Resource Sharing) configuration
    // Allows controlled access from web browsers on different domains
    app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',                              // Allow all origins by default
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],              // Allowed HTTP methods
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],  // Allowed request headers
      credentials: false                                                   // Don't include cookies in CORS requests
    }));

    // Request parsing middleware
    // Parse JSON payloads with 1MB limit to prevent memory exhaustion
    app.use(express.json({ limit: '1mb' }));
    // Parse URL-encoded form data with same limit
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Custom middleware stack for production features
    app.use(requestLoggerMiddleware);        // Request ID generation and logging
    app.use(validateJsonMiddleware);         // Content-Type validation for JSON endpoints
    app.use(validateRequestSizeMiddleware);  // Additional request size validation
    app.use(rateLimitMiddleware(15 * 60 * 1000, 100)); // Rate limiting: 100 requests per 15 minutes

    // API routes - All application endpoints are mounted here
    app.use('/', routes);

    // 404 handler for unmatched routes (must be before error handler)
    // This catches all requests that didn't match any defined routes
    app.use('*', (req, res) => {
      logger.warn(`404 - Endpoint not found: ${req.method} ${req.originalUrl}`, {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip
      });
      
      // Return structured error response consistent with other endpoints
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

    // Global error handling middleware (must be the last middleware)
    // Catches all unhandled errors and returns structured responses
    app.use(errorHandlerMiddleware);

    // Start the HTTP server
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

    // Graceful shutdown handling for production deployments
    // Ensures clean shutdown when receiving termination signals
    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      // Stop accepting new connections and close existing ones
      server.close(() => {
        logger.info('HTTP server closed');
        
        // Close database connections, cleanup resources, etc.
        // Add any additional cleanup logic here
        process.exit(0);
      });

      // Force shutdown after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Register signal handlers for common termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker/Kubernetes termination
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C in terminal

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