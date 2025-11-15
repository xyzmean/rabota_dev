import { Router } from 'express';
import {
  getAllRules,
  getEnabledRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  reorderRules,
} from '../controllers/validationRulesController';

const router = Router();

// Специальные маршруты должны быть перед :id
router.get('/enabled', getEnabledRules);
router.post('/reorder', reorderRules);

router.get('/', getAllRules);
router.get('/:id', getRuleById);
router.post('/', createRule);
router.put('/:id', updateRule);
router.patch('/:id/toggle', toggleRule);
router.delete('/:id', deleteRule);

export default router;
