import pool from '../config/database';

/**
 * AutoScheduler - Core algorithm for intelligent schedule generation
 * Implements constraint satisfaction and optimization algorithms
 */

export interface ScheduleGenerationOptions {
  month: number;
  year: number;
  options?: {
    generationId?: number;
    algorithm?: 'greedy' | 'constraint' | 'hybrid';
    optimizationFocus?: 'coverage' | 'balance' | 'preferences';
    maxIterations?: number;
    timeoutMs?: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  violations: RuleViolation[];
  warnings: RuleViolation[];
  metrics: ScheduleMetrics;
  errorCount: number;
}

export interface ScheduleResult {
  success: boolean;
  schedule: ScheduleEntry[];
  violations: RuleViolation[];
  metrics: ScheduleMetrics;
  optimizations?: OptimizationResult[];
}

export interface ScheduleEntry {
  employeeId: string;
  day: number;
  shiftId: string;
  violation?: string;
}

export interface RuleViolation {
  ruleType: string;
  severity: 'error' | 'warning';
  employeeId?: string;
  day?: number;
  shiftId?: string;
  message: string;
  priority: number;
}

export interface ScheduleMetrics {
  totalShifts: number;
  coveragePercentage: number;
  balanceScore: number;
  preferenceSatisfactionRate: number;
  violationCount: number;
  errorCount: number;
  warningCount: number;
}

export interface OptimizationResult {
  type: string;
  before: any;
  after: any;
  score: number;
}

export interface EmployeeData {
  id: string;
  name: string;
  roleId: number;
  roleName: string;
  rolePermissions: any;
  excludeFromHours: boolean;
  preferences: EmployeePreference[];
  availability: EmployeeAvailability[];
}

export interface ShiftData {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  hours: number;
  startTime?: string;
  endTime?: string;
  minStaff: number;
  maxStaff: number;
  requiredRoles: string[];
  isNight: boolean;
  coveragePriority: number;
  shiftDifficulty: number;
}

export interface EmployeePreference {
  id: string;
  employeeId?: string;
  preferenceType: string;
  targetDate: Date;
  targetShiftId?: string;
  status: string;
  priority: number;
}

export interface EmployeeAvailability {
  employeeId: string;
  date: Date;
  isAvailable: boolean;
  preferredShifts?: string[];
  avoidedShifts?: string[];
}

export interface ValidationRule {
  id: number;
  ruleType: string;
  enabled: boolean;
  config: any;
  enforcementType: 'error' | 'warning';
  priority: number;
  appliesToRoles: string[];
  appliesToEmployees: string[];
  description: string;
}

/**
 * Main AutoScheduler class
 */
export class AutoScheduler {
  private employees: EmployeeData[] = [];
  private shifts: ShiftData[] = [];
  private validationRules: ValidationRule[] = [];
  private daysInMonth: number = 0;

  /**
   * Generate schedule for specified month/year
   */
  async generateSchedule(params: ScheduleGenerationOptions): Promise<ScheduleResult> {
    const { month, year, options = {} } = params;
    const startTime = Date.now();

    try {
      // Load data
      await this.loadData(month, year);

      // Initialize empty schedule
      let schedule: ScheduleEntry[] = [];

      // Get approved day-offs and mark them as fixed constraints
      const approvedDayOffs = await this.getApprovedDayOffs(month, year);

      // Phase 1: Apply hard constraints (approved day-offs, required coverage)
      schedule = this.applyHardConstraints(schedule, approvedDayOffs, month, year);

      // Phase 2: Main scheduling algorithm
      const algorithm = options.algorithm || 'hybrid';

      switch (algorithm) {
        case 'greedy':
          schedule = this.greedySchedule(schedule, month, year, approvedDayOffs);
          break;
        case 'constraint':
          schedule = this.constraintSatisfactionSchedule(schedule, month, year, approvedDayOffs);
          break;
        case 'hybrid':
        default:
          schedule = this.hybridSchedule(schedule, month, year, approvedDayOffs);
          break;
      }

      // Phase 3: Optimize and balance
      schedule = this.optimizeSchedule(schedule, month, year, options.optimizationFocus);

      // Phase 4: Validate final schedule
      const validationResult = await this.validateScheduleIntegrity(schedule, month, year);

      const totalTime = Date.now() - startTime;
      const metrics = this.calculateScheduleMetrics(schedule, month, year);

      return {
        success: validationResult.errorCount === 0,
        schedule,
        violations: validationResult.violations,
        metrics,
        optimizations: []
      };

    } catch (error) {
      console.error('Error in generateSchedule:', error);
      throw error;
    }
  }

  /**
   * Validate existing schedule against all rules
   */
  async validateSchedule(params: { month: number; year: number }): Promise<ValidationResult> {
    const { month, year } = params;

    try {
      await this.loadData(month, year);

      // Get current schedule
      const scheduleResult = await pool.query(`
        SELECT employee_id, day, shift_id
        FROM schedule
        WHERE month = $1 AND year = $2
        ORDER BY employee_id, day
      `, [month, year]);

      const schedule: ScheduleEntry[] = scheduleResult.rows.map(row => ({
        employeeId: row.employee_id,
        day: row.day,
        shiftId: row.shift_id
      }));

      return await this.validateScheduleIntegrity(schedule, month, year);

    } catch (error) {
      console.error('Error in validateSchedule:', error);
      throw error;
    }
  }

  /**
   * Suggest improvements for existing schedule
   */
  async suggestImprovements(params: {
    month: number;
    year: number;
    focusAreas: string[];
  }): Promise<OptimizationResult[]> {
    const { month, year, focusAreas } = params;

    await this.loadData(month, year);

    const suggestions: OptimizationResult[] = [];

    // Get current schedule
    const scheduleResult = await pool.query(`
      SELECT employee_id, day, shift_id
      FROM schedule
      WHERE month = $1 AND year = $2
      ORDER BY employee_id, day
    `, [month, year]);

    const schedule: ScheduleEntry[] = scheduleResult.rows.map(row => ({
      employeeId: row.employee_id,
      day: row.day,
      shiftId: row.shift_id
    }));

    const currentMetrics = this.calculateScheduleMetrics(schedule, month, year);

    // Generate suggestions based on focus areas
    if (focusAreas.includes('balance') || focusAreas.length === 0) {
      const balanceSuggestions = this.generateBalanceSuggestions(schedule, month, year);
      suggestions.push(...balanceSuggestions);
    }

    if (focusAreas.includes('preferences') || focusAreas.length === 0) {
      const preferenceSuggestions = this.generatePreferenceSuggestions(schedule, month, year);
      suggestions.push(...preferenceSuggestions);
    }

    if (focusAreas.includes('coverage') || focusAreas.length === 0) {
      const coverageSuggestions = this.generateCoverageSuggestions(schedule, month, year);
      suggestions.push(...coverageSuggestions);
    }

    return suggestions;
  }

  /**
   * Apply specific optimization to schedule
   */
  async applyOptimization(params: {
    month: number;
    year: number;
    optimizationType: string;
    constraints: any;
  }): Promise<{ improvements: any; newViolations: RuleViolation[]; metrics: ScheduleMetrics }> {
    const { month, year, optimizationType, constraints } = params;

    await this.loadData(month, year);

    // Get current schedule
    const scheduleResult = await pool.query(`
      SELECT employee_id, day, shift_id
      FROM schedule
      WHERE month = $1 AND year = $2
      ORDER BY employee_id, day
    `, [month, year]);

    let schedule: ScheduleEntry[] = scheduleResult.rows.map(row => ({
      employeeId: row.employee_id,
      day: row.day,
      shiftId: row.shift_id
    }));

    const beforeMetrics = this.calculateScheduleMetrics(schedule, month, year);

    // Apply optimization based on type
    switch (optimizationType) {
      case 'balance':
        schedule = this.applyBalanceOptimization(schedule, month, year, constraints);
        break;
      case 'preferences':
        schedule = this.applyPreferenceOptimization(schedule, month, year, constraints);
        break;
      case 'coverage':
        schedule = this.applyCoverageOptimization(schedule, month, year, constraints);
        break;
      default:
        throw new Error(`Unknown optimization type: ${optimizationType}`);
    }

    const afterMetrics = this.calculateScheduleMetrics(schedule, month, year);
    const validationResult = await this.validateScheduleIntegrity(schedule, month, year);

    return {
      improvements: {
        before: beforeMetrics,
        after: afterMetrics,
        type: optimizationType
      },
      newViolations: validationResult.violations,
      metrics: afterMetrics
    };
  }

  /**
   * Private helper methods
   */

  private async loadData(month: number, year: number) {
    try {
      // Load employees with roles
      const employeesResult = await pool.query(`
        SELECT
          e.id,
          e.name,
          e.role_id,
          e.exclude_from_hours,
          r.name as role_name,
          r.permissions as role_permissions
        FROM employees e
        LEFT JOIN roles r ON e.role_id = r.id
        ORDER BY e.name
      `);

      this.employees = employeesResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        roleId: row.role_id,
        roleName: row.role_name || 'Unknown',
        rolePermissions: row.role_permissions || {},
        excludeFromHours: row.exclude_from_hours || false,
        preferences: [],
        availability: []
      }));

      // Load shifts
      const shiftsResult = await pool.query(`
        SELECT
          id,
          name,
          abbreviation,
          color,
          hours,
          start_time,
          end_time
        FROM shifts
        ORDER BY name
      `);

      this.shifts = shiftsResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        abbreviation: row.abbreviation,
        color: row.color,
        hours: row.hours,
        startTime: row.start_time,
        endTime: row.end_time,
        minStaff: 1, // Default values
        maxStaff: 10, // Default values
        requiredRoles: [], // Default empty array
        isNight: row.name && (row.name.toLowerCase().includes('ночь') || row.name.toLowerCase().includes('night')),
        coveragePriority: 1,
        shiftDifficulty: 1.0
      }));

      // Load validation rules
      const rulesResult = await pool.query(`
        SELECT
          id,
          rule_type,
          enabled,
          config,
          enforcement_type,
          priority,
          applies_to_roles,
          applies_to_employees,
          description
        FROM validation_rules
        WHERE enabled = true
        ORDER BY priority
      `);

      this.validationRules = rulesResult.rows.map((row: any) => ({
        id: row.id,
        ruleType: row.rule_type,
        enabled: row.enabled,
        config: row.config,
        enforcementType: row.enforcement_type || 'warning',
        priority: row.priority,
        appliesToRoles: row.applies_to_roles || [],
        appliesToEmployees: row.applies_to_employees || [],
        description: row.description
      }));

      // Load employee preferences
      const preferencesResult = await pool.query(`
        SELECT
          ep.id,
          ep.employee_id,
          ep.preference_type,
          ep.target_date,
          ep.target_shift_id,
          ep.status,
          ep.priority
        FROM employee_preferences ep
        WHERE ep.status = 'approved'
        AND (
          (EXTRACT(MONTH FROM ep.target_date) = $1 AND EXTRACT(YEAR FROM ep.target_date) = $2)
          OR ep.preference_type = 'preferred_shift'
          OR ep.preference_type = 'avoid_shift'
        )
      `, [month + 1, year]); // JavaScript months are 0-based, SQL months are 1-based

      // Group preferences by employee
      const preferencesMap = new Map<string, EmployeePreference[]>();
      preferencesResult.rows.forEach((row: any) => {
        const employeeId = row.employee_id;
        if (!preferencesMap.has(employeeId)) {
          preferencesMap.set(employeeId, []);
        }
        preferencesMap.get(employeeId)!.push({
          id: row.id.toString(),
          preferenceType: row.preference_type,
          targetDate: row.target_date,
          targetShiftId: row.target_shift_id,
          status: row.status,
          priority: row.priority,
          employeeId: row.employee_id
        });
      });

      this.employees.forEach(emp => {
        emp.preferences = preferencesMap.get(emp.id) || [];
      });

      // Calculate days in month
      this.daysInMonth = new Date(year, month + 1, 0).getDate();

    } catch (error) {
      console.error('Error loading data:', error);
      throw error;
    }
  }

  private async getApprovedDayOffs(month: number, year: number): Promise<EmployeePreference[]> {
    const result = await pool.query(`
      SELECT
        ep.id,
        ep.employee_id,
        ep.target_date,
        ep.priority
      FROM employee_preferences ep
      WHERE ep.preference_type = 'day_off'
      AND ep.status = 'approved'
      AND EXTRACT(MONTH FROM ep.target_date) = $1
      AND EXTRACT(YEAR FROM ep.target_date) = $2
    `, [month + 1, year]);

    return result.rows.map((row: any) => ({
      id: row.id.toString(),
      employeeId: row.employee_id,
      preferenceType: 'day_off',
      targetDate: row.target_date,
      status: 'approved',
      priority: row.priority
    }));
  }

  private applyHardConstraints(
    schedule: ScheduleEntry[],
    approvedDayOffs: EmployeePreference[],
    month: number,
    year: number
  ): ScheduleEntry[] {
    // Apply approved day-offs as hard constraints
    for (const dayOff of approvedDayOffs) {
      const day = new Date(dayOff.targetDate).getDate();
      const dayOffShift = this.shifts.find(s => s.id === 'Выходной');

      if (dayOffShift) {
        schedule.push({
          employeeId: dayOff.employeeId || '',
          day,
          shiftId: dayOffShift.id
        });
      }
    }

    return schedule;
  }

  private greedySchedule(
    schedule: ScheduleEntry[],
    month: number,
    year: number,
    approvedDayOffs: EmployeePreference[]
  ): ScheduleEntry[] {
    // Greedy algorithm implementation
    // This is a simplified version - in production would be more sophisticated

    const availableEmployees = this.employees.filter(emp => !emp.excludeFromHours);
    const workingDays = this.getWorkingDays(month, year);

    for (const day of workingDays) {
      const dayOffEmployees = approvedDayOffs
        .filter(doff => new Date(doff.targetDate).getDate() === day)
        .map(doff => doff.employeeId || '');

      const availableForDay = availableEmployees.filter(emp =>
        !dayOffEmployees.includes(emp.id)
      );

      // For each shift that needs to be covered
      const shiftsToCover = this.shifts.filter(shift =>
        shift.id !== 'Выходной' && shift.minStaff > 0
      );

      for (const shift of shiftsToCover) {
        const neededStaff = shift.minStaff;
        const assignedToShift = schedule.filter(s =>
          s.day === day && s.shiftId === shift.id
        ).length;

        const staffNeeded = Math.max(0, neededStaff - assignedToShift);

        if (staffNeeded > 0) {
          // Select best candidates for this shift
          const candidates = this.selectBestCandidates(
            availableForDay,
            day,
            shift,
            schedule,
            month,
            year
          );

          for (let i = 0; i < Math.min(staffNeeded, candidates.length); i++) {
            schedule.push({
              employeeId: candidates[i].id,
              day,
              shiftId: shift.id
            });
          }
        }
      }
    }

    return schedule;
  }

  private constraintSatisfactionSchedule(
    schedule: ScheduleEntry[],
    month: number,
    year: number,
    approvedDayOffs: EmployeePreference[]
  ): ScheduleEntry[] {
    // Constraint satisfaction programming approach
    // This would implement CSP with backtracking and constraint propagation

    // For now, fallback to greedy algorithm
    return this.greedySchedule(schedule, month, year, approvedDayOffs);
  }

  private hybridSchedule(
    schedule: ScheduleEntry[],
    month: number,
    year: number,
    approvedDayOffs: EmployeePreference[]
  ): ScheduleEntry[] {
    // Hybrid approach: start with greedy, then apply constraint optimization
    schedule = this.greedySchedule(schedule, month, year, approvedDayOffs);

    // Apply local optimization
    schedule = this.localSearchOptimization(schedule, month, year);

    return schedule;
  }

  private selectBestCandidates(
    employees: EmployeeData[],
    day: number,
    shift: ShiftData,
    currentSchedule: ScheduleEntry[],
    month: number,
    year: number
  ): EmployeeData[] {
    const candidates = employees.filter(emp => {
      // Check if employee already has a shift this day
      const hasShiftToday = currentSchedule.some(s =>
        s.employeeId === emp.id && s.day === day && s.shiftId !== 'Выходной'
      );
      if (hasShiftToday) return false;

      // Check consecutive days constraint
      const consecutiveDays = this.calculateConsecutiveDays(emp.id, day, currentSchedule);
      if (consecutiveDays >= 5) return false; // Hard constraint

      // Check if shift type is preferred/avoided
      const preference = emp.preferences.find(p =>
        p.preferenceType === 'preferred_shift' && p.targetShiftId === shift.id
      );
      const avoidance = emp.preferences.find(p =>
        p.preferenceType === 'avoid_shift' && p.targetShiftId === shift.id
      );

      return !avoidance; // Don't assign avoided shifts
    });

    // Sort candidates by preference score
    return candidates.sort((a, b) => {
      const scoreA = this.calculateEmployeeScore(a, day, shift, currentSchedule, month, year);
      const scoreB = this.calculateEmployeeScore(b, day, shift, currentSchedule, month, year);
      return scoreB - scoreA; // Higher score first
    });
  }

  private calculateEmployeeScore(
    employee: EmployeeData,
    day: number,
    shift: ShiftData,
    currentSchedule: ScheduleEntry[],
    month: number,
    year: number
  ): number {
    let score = 0;

    // Base score
    score += 10;

    // Preference bonus
    const preference = employee.preferences.find(p =>
      p.preferenceType === 'preferred_shift' && p.targetShiftId === shift.id
    );
    if (preference) {
      score += 20;
    }

    // Avoidance penalty
    const avoidance = employee.preferences.find(p =>
      p.preferenceType === 'avoid_shift' && p.targetShiftId === shift.id
    );
    if (avoidance) {
      score -= 50; // Heavy penalty
    }

    // Workload balance
    const currentShifts = currentSchedule.filter(s =>
      s.employeeId === employee.id && s.shiftId !== 'Выходной'
    ).length;
    const idealShifts = 20; // Target shifts per month
    const workloadPenalty = Math.abs(currentShifts - idealShifts) * 2;
    score -= workloadPenalty;

    // Role requirements
    if (shift.requiredRoles.includes(employee.roleName)) {
      score += 15;
    }

    // Consecutive days penalty
    const consecutiveDays = this.calculateConsecutiveDays(employee.id, day, currentSchedule);
    if (consecutiveDays >= 4) {
      score -= (consecutiveDays - 3) * 10;
    }

    return score;
  }

  private calculateConsecutiveDays(
    employeeId: string,
    currentDay: number,
    schedule: ScheduleEntry[]
  ): number {
    let consecutive = 0;

    // Check backwards from current day
    for (let day = currentDay - 1; day >= 1; day--) {
      const hasShift = schedule.some(s =>
        s.employeeId === employeeId &&
        s.day === day &&
        s.shiftId !== 'Выходной'
      );
      if (hasShift) {
        consecutive++;
      } else {
        break;
      }
    }

    return consecutive;
  }

  private getWorkingDays(month: number, year: number): number[] {
    const workingDays: number[] = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();

      // Consider Monday-Saturday as working days (can be customized)
      if (dayOfWeek !== 0) { // Not Sunday
        workingDays.push(day);
      }
    }

    return workingDays;
  }

  private optimizeSchedule(
    schedule: ScheduleEntry[],
    month: number,
    year: number,
    focus?: string
  ): ScheduleEntry[] {
    // Apply optimization based on focus
    switch (focus) {
      case 'balance':
        return this.applyBalanceOptimization(schedule, month, year, {});
      case 'preferences':
        return this.applyPreferenceOptimization(schedule, month, year, {});
      case 'coverage':
        return this.applyCoverageOptimization(schedule, month, year, {});
      default:
        return this.localSearchOptimization(schedule, month, year);
    }
  }

  private localSearchOptimization(
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): ScheduleEntry[] {
    // Local search with swaps and moves
    let improved = true;
    let iterations = 0;
    const maxIterations = 100;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      // Try swaps between employees
      for (let i = 0; i < schedule.length; i++) {
        for (let j = i + 1; j < schedule.length; j++) {
          const entry1 = schedule[i];
          const entry2 = schedule[j];

          // Only try swaps on the same day
          if (entry1.day !== entry2.day) continue;
          if (entry1.shiftId === entry2.shiftId) continue;

          // Test if swap improves overall score
          const beforeScore = this.calculateScheduleScore(schedule, month, year);

          // Perform swap
          const tempShiftId = entry1.shiftId;
          schedule[i] = { ...entry1, shiftId: entry2.shiftId };
          schedule[j] = { ...entry2, shiftId: tempShiftId };

          const afterScore = this.calculateScheduleScore(schedule, month, year);

          if (afterScore > beforeScore) {
            improved = true;
          } else {
            // Revert swap
            schedule[i] = { ...schedule[i], shiftId: tempShiftId };
            schedule[j] = { ...schedule[j], shiftId: entry2.shiftId };
          }
        }
      }
    }

    return schedule;
  }

  private calculateScheduleScore(
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): number {
    let score = 0;

    // Penalty for violations
    const violations = this.validateAgainstRules(schedule, month, year);
    score -= violations.length * 100;

    // Bonus for preference satisfaction
    for (const employee of this.employees) {
      for (const preference of employee.preferences) {
        const day = new Date(preference.targetDate).getDate();
        const employeeSchedule = schedule.filter(s => s.employeeId === employee.id);

        if (preference.preferenceType === 'preferred_shift') {
          const hasPreferredShift = employeeSchedule.some(s =>
            s.day === day && s.shiftId === preference.targetShiftId
          );
          if (hasPreferredShift) score += 10;
        }

        if (preference.preferenceType === 'avoid_shift') {
          const hasAvoidedShift = employeeSchedule.some(s =>
            s.day === day && s.shiftId === preference.targetShiftId
          );
          if (!hasAvoidedShift) score += 10;
        }
      }
    }

    return score;
  }

  private async validateScheduleIntegrity(
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): Promise<ValidationResult> {
    const violations = this.validateAgainstRules(schedule, month, year);
    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');

    const metrics = this.calculateScheduleMetrics(schedule, month, year);

    return {
      isValid: errors.length === 0,
      violations,
      warnings,
      metrics,
      errorCount: errors.length
    };
  }

  private validateAgainstRules(
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const rule of this.validationRules) {
      const ruleViolations = this.validateRule(rule, schedule, month, year);
      violations.push(...ruleViolations);
    }

    return violations;
  }

  private validateRule(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];

    switch (rule.ruleType) {
      case 'max_consecutive_work_days':
        violations.push(...this.validateMaxConsecutiveWorkDays(rule, schedule, month, year));
        break;
      case 'min_employees_per_shift':
        violations.push(...this.validateMinEmployeesPerShift(rule, schedule, month, year));
        break;
      case 'max_employees_per_shift':
        violations.push(...this.validateMaxEmployeesPerShift(rule, schedule, month, year));
        break;
      case 'max_hours_per_week':
        violations.push(...this.validateMaxHoursPerWeek(rule, schedule, month, year));
        break;
      case 'approved_day_off_requests':
        violations.push(...this.validateApprovedDayOffRequests(rule, schedule, month, year));
        break;
      case 'min_rest_between_shifts':
        violations.push(...this.validateMinRestBetweenShifts(rule, schedule, month, year));
        break;
      case 'required_roles_per_shift':
        violations.push(...this.validateRequiredRolesPerShift(rule, schedule, month, year));
        break;
      case 'max_shifts_per_week':
        violations.push(...this.validateMaxShiftsPerWeek(rule, schedule, month, year));
        break;
      case 'max_hours_per_month':
        violations.push(...this.validateMaxHoursPerMonth(rule, schedule, month, year));
        break;
      // Add more rule validations as needed
      default:
        console.warn(`Unknown rule type: ${rule.ruleType}`);
        break;
    }

    return violations;
  }

  private validateMaxConsecutiveWorkDays(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const maxDays = rule.config.max_days || 5;

    for (const employee of this.employees) {
      const employeeSchedule = schedule
        .filter(s => s.employeeId === employee.id && s.shiftId !== 'Выходной')
        .sort((a, b) => a.day - b.day);

      let consecutiveDays = 0;
      let lastDay = 0;

      for (const entry of employeeSchedule) {
        if (entry.day === lastDay + 1) {
          consecutiveDays++;
        } else {
          consecutiveDays = 1;
        }

        if (consecutiveDays > maxDays) {
          violations.push({
            ruleType: rule.ruleType,
            severity: rule.enforcementType,
            employeeId: employee.id,
            day: entry.day,
            message: `${employee.name} работает более ${maxDays} дней подряд`,
            priority: rule.priority
          });
        }

        lastDay = entry.day;
      }
    }

    return violations;
  }

  private validateMinEmployeesPerShift(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const minEmployees = rule.config.min || 1;

    // Group schedule by day and shift
    const shiftCoverage = new Map<string, number>();

    for (const entry of schedule) {
      if (entry.shiftId === 'Выходной') continue;

      const key = `${entry.day}-${entry.shiftId}`;
      shiftCoverage.set(key, (shiftCoverage.get(key) || 0) + 1);
    }

    // Check each day/shift combination
    for (let day = 1; day <= this.daysInMonth; day++) {
      for (const shift of this.shifts) {
        if (shift.id === 'Выходной') continue;

        const key = `${day}-${shift.id}`;
        const employeeCount = shiftCoverage.get(key) || 0;

        if (employeeCount < minEmployees) {
          violations.push({
            ruleType: rule.ruleType,
            severity: rule.enforcementType,
            day,
            shiftId: shift.id,
            message: `Смена "${shift.name}" ${day} числа имеет только ${employeeCount} сотрудника(ов), требуется минимум ${minEmployees}`,
            priority: rule.priority
          });
        }
      }
    }

    return violations;
  }

  private validateMaxEmployeesPerShift(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const maxEmployees = rule.config.max || 10;

    // Group schedule by day and shift
    const shiftCoverage = new Map<string, number>();

    for (const entry of schedule) {
      if (entry.shiftId === 'Выходной') continue;

      const key = `${entry.day}-${entry.shiftId}`;
      shiftCoverage.set(key, (shiftCoverage.get(key) || 0) + 1);
    }

    // Check each day/shift combination
    for (let day = 1; day <= this.daysInMonth; day++) {
      for (const shift of this.shifts) {
        if (shift.id === 'Выходной') continue;

        const key = `${day}-${shift.id}`;
        const employeeCount = shiftCoverage.get(key) || 0;

        if (employeeCount > maxEmployees) {
          violations.push({
            ruleType: rule.ruleType,
            severity: rule.enforcementType,
            day,
            shiftId: shift.id,
            message: `Смена "${shift.name}" ${day} числа имеет ${employeeCount} сотрудника(ов), максимум разрешено ${maxEmployees}`,
            priority: rule.priority
          });
        }
      }
    }

    return violations;
  }

  private validateMaxHoursPerWeek(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const maxHours = rule.config.max_hours || 40;

    for (const employee of this.employees) {
      const employeeSchedule = schedule.filter(s =>
        s.employeeId === employee.id && s.shiftId !== 'Выходной'
      );

      // Group by weeks
      const weeklyHours = new Map<number, number>();

      for (const entry of employeeSchedule) {
        const date = new Date(year, month, entry.day);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        const weekKey = weekStart.getTime();

        const shift = this.shifts.find(s => s.id === entry.shiftId);
        const hours = shift?.hours || 0;

        weeklyHours.set(weekKey, (weeklyHours.get(weekKey) || 0) + hours);
      }

      // Check each week
      for (const [weekKey, hours] of weeklyHours) {
        if (hours > maxHours) {
          const weekDate = new Date(weekKey);
          violations.push({
            ruleType: rule.ruleType,
            severity: rule.enforcementType,
            employeeId: employee.id,
            message: `${employee.name} работает ${hours} часов в неделю, максимум разрешено ${maxHours}`,
            priority: rule.priority
          });
        }
      }
    }

    return violations;
  }

  private validateApprovedDayOffRequests(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const employee of this.employees) {
      for (const preference of employee.preferences) {
        if (preference.preferenceType !== 'day_off') continue;

        const prefDate = new Date(preference.targetDate);
        if (prefDate.getMonth() !== month || prefDate.getFullYear() !== year) continue;

        const day = prefDate.getDate();
        const hasDayOff = schedule.some(s =>
          s.employeeId === employee.id &&
          s.day === day &&
          s.shiftId === 'Выходной'
        );

        if (!hasDayOff) {
          violations.push({
            ruleType: rule.ruleType,
            severity: rule.enforcementType,
            employeeId: employee.id,
            day,
            message: `${employee.name} должен иметь выходной ${day} числа (утвержденная заявка)`,
            priority: rule.priority
          });
        }
      }
    }

    return violations;
  }

  private validateMinRestBetweenShifts(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const minRestHours = rule.config.hours || 12;

    for (const employee of this.employees) {
      const employeeSchedule = schedule
        .filter(s => s.employeeId === employee.id && s.shiftId !== 'Выходной')
        .sort((a, b) => a.day - b.day);

      for (let i = 0; i < employeeSchedule.length - 1; i++) {
        const currentShift = employeeSchedule[i];
        const nextShift = employeeSchedule[i + 1];

        if (currentShift.day + 1 !== nextShift.day) continue; // Not consecutive days

        const currentShiftObj = this.shifts.find(s => s.id === currentShift.shiftId);
        const nextShiftObj = this.shifts.find(s => s.id === nextShift.shiftId);

        if (!currentShiftObj?.endTime || !nextShiftObj?.startTime) continue;

        // Parse times
        const currentEndTime = this.parseTime(currentShiftObj.endTime);
        const nextStartTime = this.parseTime(nextShiftObj.startTime);

        // Calculate rest hours
        const restHours = currentEndTime < nextStartTime
          ? nextStartTime - currentEndTime
          : (24 - currentEndTime) + nextStartTime;

        if (restHours < minRestHours) {
          violations.push({
            ruleType: rule.ruleType,
            severity: rule.enforcementType,
            employeeId: employee.id,
            day: nextShift.day,
            message: `${employee.name} имеет только ${restHours}ч отдыха между сменами, минимум ${minRestHours}ч`,
            priority: rule.priority
          });
        }
      }
    }

    return violations;
  }

  private validateRequiredRolesPerShift(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const requiredRole = rule.config.role;
    const minCount = rule.config.min_count || 1;

    if (!requiredRole) return violations;

    // Check each day/shift combination
    for (let day = 1; day <= this.daysInMonth; day++) {
      for (const shift of this.shifts) {
        if (shift.id === 'Выходной') continue;

        const dayShiftEmployees = schedule.filter(s =>
          s.day === day && s.shiftId === shift.id
        );

        const employeesWithRole = dayShiftEmployees.filter(s => {
          const employee = this.employees.find(e => e.id === s.employeeId);
          return employee?.roleName === requiredRole;
        });

        if (employeesWithRole.length < minCount) {
          violations.push({
            ruleType: rule.ruleType,
            severity: rule.enforcementType,
            day,
            shiftId: shift.id,
            message: `Смена "${shift.name}" ${day} числа требует минимум ${minCount} сотрудника(ов) с ролью "${requiredRole}"`,
            priority: rule.priority
          });
        }
      }
    }

    return violations;
  }

  private validateMaxShiftsPerWeek(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const maxShifts = rule.config.max || 5;

    for (const employee of this.employees) {
      const employeeSchedule = schedule.filter(s =>
        s.employeeId === employee.id && s.shiftId !== 'Выходной'
      );

      // Group by weeks
      const weeklyShifts = new Map<number, number>();

      for (const entry of employeeSchedule) {
        const date = new Date(year, month, entry.day);
        const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
        const weekKey = weekStart.getTime();

        weeklyShifts.set(weekKey, (weeklyShifts.get(weekKey) || 0) + 1);
      }

      // Check each week
      for (const [weekKey, shifts] of weeklyShifts) {
        if (shifts > maxShifts) {
          violations.push({
            ruleType: rule.ruleType,
            severity: rule.enforcementType,
            employeeId: employee.id,
            message: `${employee.name} работает ${shifts} смен в неделю, максимум разрешено ${maxShifts}`,
            priority: rule.priority
          });
        }
      }
    }

    return violations;
  }

  private validateMaxHoursPerMonth(
    rule: ValidationRule,
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];
    const maxHours = rule.config.max_hours || 160;

    for (const employee of this.employees) {
      const employeeSchedule = schedule.filter(s =>
        s.employeeId === employee.id && s.shiftId !== 'Выходной'
      );

      let totalHours = 0;
      for (const entry of employeeSchedule) {
        const shift = this.shifts.find(s => s.id === entry.shiftId);
        totalHours += shift?.hours || 0;
      }

      if (totalHours > maxHours) {
        violations.push({
          ruleType: rule.ruleType,
          severity: rule.enforcementType,
          employeeId: employee.id,
          message: `${employee.name} работает ${totalHours} часов в месяц, максимум разрешено ${maxHours}`,
          priority: rule.priority
        });
      }
    }

    return violations;
  }

  private parseTime(timeStr: string): number {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes || 0) / 60;
  }

  private calculateScheduleMetrics(
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): ScheduleMetrics {
    const violations = this.validateAgainstRules(schedule, month, year);
    const errors = violations.filter(v => v.severity === 'error');
    const warnings = violations.filter(v => v.severity === 'warning');

    // Calculate coverage percentage
    let totalRequiredSlots = 0;
    let filledSlots = 0;

    for (let day = 1; day <= this.daysInMonth; day++) {
      for (const shift of this.shifts) {
        if (shift.id === 'Выходной') continue;

        totalRequiredSlots += shift.minStaff;
        filledSlots += schedule.filter(s =>
          s.day === day && s.shiftId === shift.id
        ).length;
      }
    }

    const coveragePercentage = totalRequiredSlots > 0
      ? Math.min(100, (filledSlots / totalRequiredSlots) * 100)
      : 100;

    // Calculate balance score
    const employeeShiftCounts = new Map<string, number>();
    for (const employee of this.employees) {
      const count = schedule.filter(s =>
        s.employeeId === employee.id && s.shiftId !== 'Выходной'
      ).length;
      employeeShiftCounts.set(employee.id, count);
    }

    const counts = Array.from(employeeShiftCounts.values());
    const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / counts.length;
    const balanceScore = Math.max(0, 100 - variance * 2);

    // Calculate preference satisfaction rate
    let totalPreferences = 0;
    let satisfiedPreferences = 0;

    for (const employee of this.employees) {
      for (const preference of employee.preferences) {
        if (preference.preferenceType !== 'day_off') continue;

        totalPreferences++;
        const day = new Date(preference.targetDate).getDate();
        const hasDayOff = schedule.some(s =>
          s.employeeId === employee.id &&
          s.day === day &&
          s.shiftId === 'Выходной'
        );

        if (hasDayOff) {
          satisfiedPreferences++;
        }
      }
    }

    const preferenceSatisfactionRate = totalPreferences > 0
      ? (satisfiedPreferences / totalPreferences) * 100
      : 100;

    return {
      totalShifts: schedule.filter(s => s.shiftId !== 'Выходной').length,
      coveragePercentage,
      balanceScore,
      preferenceSatisfactionRate,
      violationCount: violations.length,
      errorCount: errors.length,
      warningCount: warnings.length
    };
  }

  private applyBalanceOptimization(
    schedule: ScheduleEntry[],
    month: number,
    year: number,
    constraints: any
  ): ScheduleEntry[] {
    // Implementation for workload balancing
    return schedule; // Placeholder
  }

  private applyPreferenceOptimization(
    schedule: ScheduleEntry[],
    month: number,
    year: number,
    constraints: any
  ): ScheduleEntry[] {
    // Implementation for preference satisfaction
    return schedule; // Placeholder
  }

  private applyCoverageOptimization(
    schedule: ScheduleEntry[],
    month: number,
    year: number,
    constraints: any
  ): ScheduleEntry[] {
    // Implementation for coverage optimization
    return schedule; // Placeholder
  }

  private generateBalanceSuggestions(
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): OptimizationResult[] {
    // Generate suggestions for improving workload balance
    return []; // Placeholder
  }

  private generatePreferenceSuggestions(
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): OptimizationResult[] {
    // Generate suggestions for improving preference satisfaction
    return []; // Placeholder
  }

  private generateCoverageSuggestions(
    schedule: ScheduleEntry[],
    month: number,
    year: number
  ): OptimizationResult[] {
    // Generate suggestions for improving shift coverage
    return []; // Placeholder
  }
}