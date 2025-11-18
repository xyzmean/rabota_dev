import { Request, Response } from 'express';
import { AutoScheduler } from '../services/autoScheduler';
import pool from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Controller for auto-scheduling functionality
 * Implements the AutoSched system for intelligent schedule generation
 */
export class AutoScheduleController {
  private autoScheduler: AutoScheduler;

  constructor() {
    this.autoScheduler = new AutoScheduler();
  }

  /**
   * Generate schedule for a specific month/year
   * POST /api/auto-schedule/generate
   */
  generateSchedule = async (req: Request, res: Response) => {
    try {
      const { month, year, options = {} } = req.body;

      // Validate required parameters
      if (month === undefined || year === undefined) {
        return res.status(400).json({
          error: 'Month and year are required',
          details: 'Please provide valid month (0-11) and year values'
        });
      }

      // Validate month range
      if (month < 0 || month > 11) {
        return res.status(400).json({
          error: 'Invalid month',
          details: 'Month must be between 0 (January) and 11 (December)'
        });
      }

      // Validate year
      const currentYear = new Date().getFullYear();
      if (year < currentYear - 1 || year > currentYear + 2) {
        return res.status(400).json({
          error: 'Invalid year',
          details: `Year must be between ${currentYear - 1} and ${currentYear + 2}`
        });
      }

      // Get current user from authentication middleware
      const generatedBy = (req as AuthenticatedRequest).user?.id || null;

      // Create generation record
      const generationResult = await pool.query(`
        INSERT INTO schedule_generations (month, year, status, generated_by, algorithm_config)
        VALUES ($1, $2, 'pending', $3, $4)
        ON CONFLICT (month, year)
        DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [month, year, generatedBy, JSON.stringify(options)]);

      const generationId = generationResult.rows[0].id;

      // Update status to in_progress
      await pool.query(
        'UPDATE schedule_generations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['in_progress', generationId]
      );

      // Generate schedule using AutoScheduler
      const startTime = Date.now();
      const result = await this.autoScheduler.generateSchedule({
        month,
        year,
        options: {
          ...options,
          generationId
        }
      });
      const generationTime = Date.now() - startTime;

      // Save generation results
      await pool.query(`
        UPDATE schedule_generations
        SET
          status = $1,
          total_violations = $2,
          violation_details = $3,
          generation_time_ms = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [
        result.success ? 'completed' : 'failed',
        result.violations?.length || 0,
        JSON.stringify(result.violations || []),
        generationTime,
        generationId
      ]);

      // Save optimization metrics if available
      if (result.optimizations && result.optimizations.length > 0) {
        for (const optimization of result.optimizations) {
          await pool.query(`
            INSERT INTO schedule_optimizations (
              generation_id, optimization_type, before_metrics, after_metrics, improvement_score
            ) VALUES ($1, $2, $3, $4, $5)
          `, [
            generationId,
            optimization.type,
            JSON.stringify(optimization.before),
            JSON.stringify(optimization.after),
            optimization.score || 0
          ]);
        }
      }

      // Update employee workload statistics
      await this.updateWorkloadStats(month, year);

      res.json({
        success: true,
        generationId,
        month,
        year,
        schedule: result.schedule,
        violations: result.violations || [],
        metrics: result.metrics,
        generationTime,
        message: result.success
          ? 'Schedule generated successfully'
          : 'Schedule generated with some violations'
      });

    } catch (error) {
      console.error('Error generating schedule:', error);

      // Update generation status to failed if we have a generation ID
      if (req.body?.month !== undefined && req.body?.year !== undefined) {
        try {
          await pool.query(`
            UPDATE schedule_generations
            SET status = 'failed', updated_at = CURRENT_TIMESTAMP
            WHERE month = $1 AND year = $2
          `, [req.body.month, req.body.year]);
        } catch (updateError) {
          console.error('Error updating generation status:', updateError);
        }
      }

      res.status(500).json({
        error: 'Failed to generate schedule',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Get generation history and status
   * GET /api/auto-schedule/history
   */
  getGenerationHistory = async (req: Request, res: Response) => {
    try {
      const { month, year, limit = 12 } = req.query;

      let query = `
        SELECT
          sg.*,
          e.name as generated_by_name
        FROM schedule_generations sg
        LEFT JOIN employees e ON sg.generated_by = e.id
      `;
      const params: any[] = [];

      if (month !== undefined && year !== undefined) {
        query += ' WHERE sg.month = $1 AND sg.year = $2';
        params.push(parseInt(month as string), parseInt(year as string));
      }

      query += ' ORDER BY sg.created_at DESC LIMIT $' + (params.length + 1);
      params.push(parseInt(limit as string));

      const result = await pool.query(query, params);

      res.json({
        success: true,
        generations: result.rows
      });

    } catch (error) {
      console.error('Error fetching generation history:', error);
      res.status(500).json({
        error: 'Failed to fetch generation history',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Validate current schedule against all rules
   * POST /api/auto-schedule/validate
   */
  validateSchedule = async (req: Request, res: Response) => {
    try {
      const { month, year } = req.body;

      if (month === undefined || year === undefined) {
        return res.status(400).json({
          error: 'Month and year are required'
        });
      }

      const result = await this.autoScheduler.validateSchedule({
        month,
        year
      });

      res.json({
        success: true,
        isValid: result.isValid,
        violations: result.violations,
        warnings: result.warnings,
        metrics: result.metrics
      });

    } catch (error) {
      console.error('Error validating schedule:', error);
      res.status(500).json({
        error: 'Failed to validate schedule',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Get suggested improvements for current schedule
   * POST /api/auto-schedule/suggest-improvements
   */
  suggestImprovements = async (req: Request, res: Response) => {
    try {
      const { month, year, focus_areas = [] } = req.body;

      if (month === undefined || year === undefined) {
        return res.status(400).json({
          error: 'Month and year are required'
        });
      }

      const suggestions = await this.autoScheduler.suggestImprovements({
        month,
        year,
        focusAreas: focus_areas
      });

      res.json({
        success: true,
        suggestions,
        potentialImprovements: suggestions.length
      });

    } catch (error) {
      console.error('Error generating suggestions:', error);
      res.status(500).json({
        error: 'Failed to generate suggestions',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Apply specific optimization to schedule
   * POST /api/auto-schedule/optimize
   */
  optimizeSchedule = async (req: Request, res: Response) => {
    try {
      const { month, year, optimization_type, constraints = {} } = req.body;

      if (month === undefined || year === undefined || !optimization_type) {
        return res.status(400).json({
          error: 'Month, year, and optimization_type are required'
        });
      }

      const result = await this.autoScheduler.applyOptimization({
        month,
        year,
        optimizationType: optimization_type,
        constraints
      });

      res.json({
        success: true,
        optimizationType: optimization_type,
        improvements: result.improvements,
        newViolations: result.newViolations,
        metrics: result.metrics
      });

    } catch (error) {
      console.error('Error applying optimization:', error);
      res.status(500).json({
        error: 'Failed to apply optimization',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Get employee workload statistics
   * GET /api/auto-schedule/workload-stats
   */
  getWorkloadStats = async (req: Request, res: Response) => {
    try {
      const { month, year, employee_id } = req.query;

      if (month === undefined || year === undefined) {
        return res.status(400).json({
          error: 'Month and year are required'
        });
      }

      let query = `
        SELECT
          ews.*,
          e.name as employee_name,
          r.name as role_name,
          r.color as role_color
        FROM employee_workload_stats ews
        JOIN employees e ON ews.employee_id = e.id
        LEFT JOIN roles r ON e.role_id = r.id
        WHERE ews.month = $1 AND ews.year = $2
      `;
      const params: any[] = [parseInt(month as string), parseInt(year as string)];

      if (employee_id) {
        query += ' AND ews.employee_id = $3';
        params.push(employee_id as string);
      }

      query += ' ORDER BY ews.workload_score DESC';

      const result = await pool.query(query, params);

      res.json({
        success: true,
        month: parseInt(month as string),
        year: parseInt(year as string),
        stats: result.rows
      });

    } catch (error) {
      console.error('Error fetching workload stats:', error);
      res.status(500).json({
        error: 'Failed to fetch workload statistics',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Get available schedule templates
   * GET /api/auto-schedule/templates
   */
  getScheduleTemplates = async (req: Request, res: Response) => {
    try {
      const result = await pool.query(`
        SELECT
          st.*,
          e.name as created_by_name
        FROM schedule_templates st
        LEFT JOIN employees e ON st.created_by = e.id
        WHERE st.is_active = true
        ORDER BY st.name
      `);

      res.json({
        success: true,
        templates: result.rows
      });

    } catch (error) {
      console.error('Error fetching schedule templates:', error);
      res.status(500).json({
        error: 'Failed to fetch schedule templates',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Create new schedule template
   * POST /api/auto-schedule/templates
   */
  createScheduleTemplate = async (req: Request, res: Response) => {
    try {
      const { name, description, pattern_data } = req.body;

      if (!name || !pattern_data) {
        return res.status(400).json({
          error: 'Name and pattern_data are required'
        });
      }

      const createdBy = (req as AuthenticatedRequest).user?.id || null;

      const result = await pool.query(`
        INSERT INTO schedule_templates (name, description, pattern_data, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [name, description, JSON.stringify(pattern_data), createdBy]);

      res.status(201).json({
        success: true,
        template: result.rows[0]
      });

    } catch (error) {
      console.error('Error creating schedule template:', error);
      res.status(500).json({
        error: 'Failed to create schedule template',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  /**
   * Helper method to update employee workload statistics
   */
  private updateWorkloadStats = async (month: number, year: number) => {
    try {
      // Get all employees
      const employees = await pool.query(`
        SELECT id, name FROM employees
      `);

      // Calculate stats for each employee
      for (const employee of employees.rows) {
        const stats = await this.calculateEmployeeStats(employee.id, month, year);

        await pool.query(`
          INSERT INTO employee_workload_stats (
            employee_id, month, year, total_shifts, total_hours,
            consecutive_days_max, night_shifts_count, weekend_shifts_count,
            preference_satisfaction_rate, workload_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (employee_id, month, year)
          DO UPDATE SET
            total_shifts = EXCLUDED.total_shifts,
            total_hours = EXCLUDED.total_hours,
            consecutive_days_max = EXCLUDED.consecutive_days_max,
            night_shifts_count = EXCLUDED.night_shifts_count,
            weekend_shifts_count = EXCLUDED.weekend_shifts_count,
            preference_satisfaction_rate = EXCLUDED.preference_satisfaction_rate,
            workload_score = EXCLUDED.workload_score,
            updated_at = CURRENT_TIMESTAMP
        `, [
          employee.id, month, year,
          stats.totalShifts,
          stats.totalHours,
          stats.consecutiveDaysMax,
          stats.nightShiftsCount,
          stats.weekendShiftsCount,
          stats.preferenceSatisfactionRate,
          stats.workloadScore
        ]);
      }
    } catch (error) {
      console.error('Error updating workload stats:', error);
    }
  };

  /**
   * Helper method to calculate individual employee statistics
   */
  private calculateEmployeeStats = async (employeeId: string, month: number, year: number) => {
    try {
      // Get employee's schedule for the month
      const scheduleResult = await pool.query(`
        SELECT
          s.day,
          s.shift_id,
          sh.hours,
          sh.is_night,
          sh.name as shift_name
        FROM schedule s
        JOIN shifts sh ON s.shift_id = sh.id
        WHERE s.employee_id = $1 AND s.month = $2 AND s.year = $3
        AND s.shift_id != 'Выходной'
        ORDER BY s.day
      `, [employeeId, month, year]);

      const shifts = scheduleResult.rows;

      // Calculate basic stats
      const totalShifts = shifts.length;
      const totalHours = shifts.reduce((sum: number, shift: any) => sum + (shift.hours || 0), 0);
      const nightShiftsCount = shifts.filter((shift: any) => shift.is_night).length;

      // Calculate weekend shifts
      const weekendShiftsCount = shifts.filter((shift: any) => {
        const date = new Date(year, month, shift.day);
        const dayOfWeek = date.getDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      }).length;

      // Calculate max consecutive days
      let consecutiveDaysMax = 0;
      let currentConsecutive = 0;
      let lastDay = 0;

      for (const shift of shifts) {
        if (shift.day === lastDay + 1) {
          currentConsecutive++;
        } else {
          currentConsecutive = 1;
        }
        consecutiveDaysMax = Math.max(consecutiveDaysMax, currentConsecutive);
        lastDay = shift.day;
      }

      // Calculate preference satisfaction (placeholder - would need actual preference data)
      const preferenceSatisfactionRate = 85.0; // Placeholder value

      // Calculate workload score (0-100)
      const idealShiftsPerMonth = 20; // Placeholder
      const workloadScore = Math.min(100, Math.max(0,
        100 - Math.abs(totalShifts - idealShiftsPerMonth) * 5
      ));

      return {
        totalShifts,
        totalHours,
        consecutiveDaysMax,
        nightShiftsCount,
        weekendShiftsCount,
        preferenceSatisfactionRate,
        workloadScore
      };

    } catch (error) {
      console.error('Error calculating employee stats:', error);
      return {
        totalShifts: 0,
        totalHours: 0,
        consecutiveDaysMax: 0,
        nightShiftsCount: 0,
        weekendShiftsCount: 0,
        preferenceSatisfactionRate: 0,
        workloadScore: 0
      };
    }
  };
}