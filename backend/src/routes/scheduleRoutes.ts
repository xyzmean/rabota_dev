import { Router } from 'express';
import {
  getAllSchedule,
  getScheduleById,
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  deleteScheduleByDateAndEmployee,
  bulkUpsertSchedule,
  validateScheduleController
} from '../controllers/scheduleController';

const router = Router();

/**
 * @route   GET /api/schedule
 * @desc    Получить весь график (с опциональными параметрами start_date, end_date)
 */
router.get('/', getAllSchedule);

/**
 * @route   GET /api/schedule/validate
 * @desc    Валидировать график по правилам (требуются параметры month и year)
 */
router.get('/validate', validateScheduleController);

/**
 * @route   GET /api/schedule/:id
 * @desc    Получить запись графика по ID
 */
router.get('/:id', getScheduleById);

/**
 * @route   POST /api/schedule
 * @desc    Создать запись в графике
 */
router.post('/', createScheduleEntry);

/**
 * @route   PUT /api/schedule/:id
 * @desc    Обновить запись в графике
 */
router.put('/:id', updateScheduleEntry);

/**
 * @route   DELETE /api/schedule/:id
 * @desc    Удалить запись из графика
 */
router.delete('/:id', deleteScheduleEntry);

/**
 * @route   POST /api/schedule/delete-by-date
 * @desc    Удалить запись по дате и сотруднику
 */
router.post('/delete-by-date', deleteScheduleByDateAndEmployee);

/**
 * @route   POST /api/schedule/bulk
 * @desc    Массовое создание/обновление записей графика
 */
router.post('/bulk', bulkUpsertSchedule);

export default router;
