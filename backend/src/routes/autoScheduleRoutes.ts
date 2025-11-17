import express from 'express';
import { body } from 'express-validator';
import { generateSchedule, clearAllDatabase } from '../controllers/autoScheduleController';

const router = express.Router();

// POST /api/auto-schedule/generate - Генерация графика
router.post('/generate',
  [
    body('month')
      .isInt({ min: 0, max: 11 })
      .withMessage('Месяц должен быть числом от 0 до 11'),
    body('year')
      .isInt({ min: 2020, max: 2030 })
      .withMessage('Год должен быть числом от 2020 до 2030')
  ],
  generateSchedule
);

// POST /api/auto-schedule/clear-database - Полная очистка базы данных
router.post('/clear-database', async (req, res) => {
  try {
    await clearAllDatabase();
    res.json({
      success: true,
      message: 'База данных полностью очищена'
    });
  } catch (error) {
    console.error('Ошибка при очистке базы данных:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;