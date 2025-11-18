import { Router } from 'express';
import { AutoScheduleController } from '../controllers/autoScheduleController';
import { authenticateToken, requirePermission } from '../middleware/auth';

const router = Router();
const autoScheduleController = new AutoScheduleController();

/**
 * Auto-Scheduling Routes
 * Implements the AutoSched system endpoints
 */

// Generate schedule for a specific month/year
router.post('/generate', authenticateToken, requirePermission('manage_schedule'), autoScheduleController.generateSchedule);

// Get generation history and status
router.get('/history', authenticateToken, requirePermission('view_statistics'), autoScheduleController.getGenerationHistory);

// Validate current schedule against all rules
router.post('/validate', authenticateToken, requirePermission('manage_schedule'), autoScheduleController.validateSchedule);

// Get suggested improvements for current schedule
router.post('/suggest-improvements', authenticateToken, requirePermission('manage_schedule'), autoScheduleController.suggestImprovements);

// Apply specific optimization to schedule
router.post('/optimize', authenticateToken, requirePermission('manage_schedule'), autoScheduleController.optimizeSchedule);

// Get employee workload statistics
router.get('/workload-stats', authenticateToken, requirePermission('view_statistics'), autoScheduleController.getWorkloadStats);

// Get available schedule templates
router.get('/templates', authenticateToken, requirePermission('manage_schedule'), autoScheduleController.getScheduleTemplates);

// Create new schedule template
router.post('/templates', authenticateToken, requirePermission('manage_settings'), autoScheduleController.createScheduleTemplate);

export default router;