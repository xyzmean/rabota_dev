import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import { runMigrations } from './db/migrations';

// Импорт маршрутов
import employeeRoutes from './routes/employeeRoutes';
import shiftRoutes from './routes/shiftRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import settingsRoutes from './routes/settingsRoutes';
import preferencesRoutes from './routes/preferencesRoutes';
import preferenceReasonsRoutes from './routes/preferenceReasonsRoutes';
import roleRoutes from './routes/roleRoutes';
import databaseRoutes from './routes/databaseRoutes';

// Загрузка переменных окружения
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware - CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, mobile apps, curl, same-origin)
    if (!origin) return callback(null, true);

    // В development режиме разрешаем все localhost origins
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }

    // Production allowed origins
    const allowedOrigins = [
      'https://rabota.yo1nk.ru',
      'http://rabota.yo1nk.ru'
    ];

    if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN === '*') {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'production') {
      callback(new Error('Not allowed by CORS'));
    } else {
      // В dev режиме разрешаем все
      callback(null, true);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование запросов в режиме разработки
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api/employees', employeeRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/preferences', preferencesRoutes);
app.use('/api/preference-reasons', preferenceReasonsRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/database', databaseRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'RaboTA API Server',
    version: '2.2.0',
    endpoints: {
      employees: '/api/employees',
      shifts: '/api/shifts',
      schedule: '/api/schedule',
      settings: '/api/settings',
      preferences: '/api/preferences',
      preferenceReasons: '/api/preference-reasons',
      roles: '/api/roles',
      database: '/api/database',
      health: '/health'
    }
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Функция запуска сервера
const startServer = async () => {
  try {
    // Проверка подключения к БД
    await testConnection();

    // Запуск миграций
    await runMigrations();

    // Запуск сервера
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 API URL: http://localhost:${PORT}`);
      console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Запуск сервера
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  process.exit(0);
});
