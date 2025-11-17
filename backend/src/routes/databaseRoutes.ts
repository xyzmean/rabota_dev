import express from 'express';
import { clearDatabase, clearSchedule, getDatabaseStats } from '../controllers/databaseController';

const router = express.Router();

// GET /api/database/stats - Получить статистику БД
router.get('/stats', getDatabaseStats);

// DELETE /api/database/clear - Полная очистка БД
router.delete('/clear', clearDatabase);

// DELETE /api/database/schedule - Очистка графика
router.delete('/schedule', clearSchedule);

export default router;