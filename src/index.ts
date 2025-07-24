import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config, validateConfig } from './config';
import routes from './routes';

async function startServer() {
  try {
    // Validate configuration
    validateConfig();
    console.log('Configuration validated successfully');

    // Create Express app
    const app = express();

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Routes
    app.use('/', routes);

    // Error handling middleware
    app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint not found'
      });
    });

    // Start server
    const port = config.port;
    app.listen(port, () => {
      console.log(`K1 Starknet Adapter server running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Invoice endpoint: http://localhost:${port}/api/invoice`);
      console.log('Server ready to handle atomic swaps between Starknet and Lightning');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});