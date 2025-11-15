import { Router } from 'express';
import {
  getAllPreferences,
  getPreferenceById,
  getPreferencesByEmployee,
  createPreference,
  updatePreference,
  updatePreferenceStatus,
  deletePreference,
} from '../controllers/preferencesController';

const router = Router();

// Специальные маршруты должны быть перед :id
router.get('/employee/:employeeId', getPreferencesByEmployee);

router.get('/', getAllPreferences);
router.get('/:id', getPreferenceById);
router.post('/', createPreference);
router.put('/:id', updatePreference);
router.patch('/:id/status', updatePreferenceStatus);
router.delete('/:id', deletePreference);

export default router;
