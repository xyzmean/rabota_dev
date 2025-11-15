import { Router } from 'express';
import {
  getAllSettings,
  getSettingByKey,
  createSetting,
  updateSetting,
  deleteSetting,
  getBulkSettings,
} from '../controllers/settingsController';

const router = Router();

// Bulk endpoint должен быть перед :key, чтобы не перехватывался как key="bulk"
router.get('/bulk', getBulkSettings);

router.get('/', getAllSettings);
router.get('/:key', getSettingByKey);
router.post('/', createSetting);
router.put('/:key', updateSetting);
router.delete('/:key', deleteSetting);

export default router;
