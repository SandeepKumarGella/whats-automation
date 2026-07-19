import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logger } from './utils/logger.js';
import router from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for Vite frontend (Local and Vercel production)
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Mount all API endpoints under /api
app.use('/api', router);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Global Exception Handler / Express Middleware Error Boundary
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Global Exception Caught: ${err.message}\n${err.stack}`);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
    }
  });
});

// Start listening
const server = app.listen(PORT, () => {
  logger.info(`WhatsApp Automation Backend started on port ${PORT}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received. Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  logger.error(`UNCAUGHT EXCEPTION: ${error.message}\n${error.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`UNHANDLED REJECTION: Reason: ${reason}`);
});
