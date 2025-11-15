import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Конфигурация пула подключений PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'rabota_db',
  user: process.env.DB_USER || 'rabota_user',
  password: process.env.DB_PASSWORD,
  // Оптимизация для сервера с ограниченными ресурсами (1 CPU, 2GB RAM)
  max: 10, // Максимум 10 подключений (для 3-4 пользователей этого достаточно)
  idleTimeoutMillis: 30000, // Закрывать неактивные соединения через 30 секунд
  connectionTimeoutMillis: 2000, // Таймаут подключения 2 секунды
});

// Обработка ошибок пула
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Проверка подключения при старте
export const testConnection = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    console.log('✓ PostgreSQL connected successfully');
    client.release();
  } catch (err) {
    console.error('✗ PostgreSQL connection error:', err);
    throw err;
  }
};

export default pool;
