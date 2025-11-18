/**
 * Schedule Validation Service
 * Проверяет график работы на соответствие правилам валидации
 */

import { ValidationRule, ScheduleEntry, Employee, Shift } from '../models/types';

/**
 * Форматирует дату в формате YYYY-MM-DD
 */
function formatDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export interface ValidationViolation {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  employeeId?: string;
  date?: string; // YYYY-MM-DD
  metadata?: Record<string, any>;
}

export interface ScheduleValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
}

export interface ValidationContext {
  schedule: ScheduleEntry[];
  employees: Employee[];
  shifts: Shift[];
  month: number;
  year: number;
  approvedDayOffs?: Array<{
    employeeId: string;
    date: string; // YYYY-MM-DD
  }>;
}

export async function evaluateValidationRule(
  rule: ValidationRule,
  context: ValidationContext
): Promise<ValidationViolation[]> {
  return validateRule(rule, context);
}

/**
 * Главная функция валидации графика
 */
export async function validateSchedule(
  context: ValidationContext,
  rules: ValidationRule[]
): Promise<ScheduleValidationResult> {
  const violations: ValidationViolation[] = [];

  // Фильтруем только включенные правила и сортируем по приоритету
  const enabledRules = rules
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of enabledRules) {
    const ruleViolations = await validateRule(rule, context);
    violations.push(...ruleViolations);
  }

  return {
    isValid: violations.filter(v => v.severity === 'error').length === 0,
    violations,
  };
}

/**
 * Валидация конкретного правила
 */
async function validateRule(
  rule: ValidationRule,
  context: ValidationContext
): Promise<ValidationViolation[]> {
  switch (rule.ruleType) {
    case 'max_consecutive_shifts':
      return validateMaxConsecutiveShifts(rule, context);
    case 'min_employees_per_shift':
      return validateMinEmployeesPerShift(rule, context);
    case 'max_employees_per_shift':
      return validateMaxEmployeesPerShift(rule, context);
    case 'max_employees_per_shift_type':
      return validateMaxEmployeesPerShiftType(rule, context);
    case 'required_coverage':
      return validateRequiredCoverage(rule, context);
    case 'manager_requirements':
      return validateManagerRequirements(rule, context);
    case 'max_total_hours':
      return validateMaxTotalHours(rule, context);
    case 'max_hours_without_managers':
      return validateMaxHoursWithoutManagers(rule, context);
    case 'employee_hours_limit':
      return validateEmployeeHoursLimit(rule, context);
    case 'recommended_work_days':
      return validateRecommendedWorkDays(rule, context);
    case 'required_work_days':
      return validateRequiredWorkDays(rule, context);
    case 'coverage_by_time':
      return validateCoverageByTime(rule, context);
    case 'coverage_by_day':
      return validateCoverageByDay(rule, context);
    case 'shift_type_limit_per_day':
      return validateShiftTypeLimitPerDay(rule, context);
    case 'max_consecutive_work_days':
      return validateMaxConsecutiveWorkDays(rule, context);
    case 'max_consecutive_days_off':
      return validateMaxConsecutiveDaysOff(rule, context);
    case 'employee_day_off':
      return validateEmployeeDayOff(rule, context);
    case 'approved_day_off_requests':
      return validateApprovedDayOffRequests(rule, context);
    default:
      return [];
  }
}

/**
 * Проверка максимального количества смен подряд
 */
function validateMaxConsecutiveShifts(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const maxDays = rule.config.max_days || 6;
  const { schedule, employees, shifts } = context;

  // Группируем записи по сотрудникам
  const employeeSchedules = groupByEmployee(schedule);

  for (const [employeeId, entries] of Object.entries(employeeSchedules)) {
    // Проверяем, применяется ли правило к этому сотруднику
    if (!isRuleApplicable(rule, employeeId, employees)) {
      continue;
    }

    const employee = employees.find(e => e.id === employeeId);
    if (!employee) continue;

    // Сортируем по дате
    const sortedEntries = sortByDate(entries);
    let consecutiveDays = 0;
    let startDate: Date | null = null;

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      const shift = shifts.find(s => s.id === entry.shiftId);

      // Проверяем, является ли это рабочей сменой (не выходной)
      if (shift && shift.hours > 0) {
        if (consecutiveDays === 0) {
          startDate = new Date(entry.year, entry.month, entry.day);
        }
        consecutiveDays++;

        // Проверяем, не превышен ли лимит
        if (consecutiveDays > maxDays) {
          violations.push({
            type: rule.ruleType,
            severity: rule.enforcementType || 'warning',
            message: rule.customMessage ||
              `${employee.name}: ${consecutiveDays} рабочих дней подряд (макс: ${maxDays})`,
            employeeId,
            date: formatDate(entry.year, entry.month, entry.day),
            metadata: { consecutiveDays, maxDays },
          });
        }
      } else {
        // Выходной - сбрасываем счетчик
        consecutiveDays = 0;
        startDate = null;
      }
    }
  }

  return violations;
}

/**
 * Проверка минимального количества сотрудников в смене
 */
function validateMinEmployeesPerShift(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const minCount = rule.config.min_count || 2;
  const { schedule, shifts } = context;

  // Группируем по дате
  const dateGroups = groupByDate(schedule);

  for (const [dateKey, entries] of Object.entries(dateGroups)) {
    // Считаем только записи с рабочими сменами
    const workingEmployees = entries.filter(entry => {
      const shift = shifts.find(s => s.id === entry.shiftId);
      return shift && shift.hours > 0;
    });

    if (workingEmployees.length < minCount && workingEmployees.length > 0) {
      const [year, month, day] = dateKey.split('-').map(Number);
      violations.push({
        type: rule.ruleType,
        severity: rule.enforcementType || 'warning',
        message: rule.customMessage ||
          `${formatDate(year, month, day)}: ${workingEmployees.length} сотрудников (мин: ${minCount})`,
        date: formatDate(year, month, day),
        metadata: { currentCount: workingEmployees.length, minCount },
      });
    }
  }

  return violations;
}

/**
 * Проверка максимального количества сотрудников в смене
 */
function validateMaxEmployeesPerShift(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const maxCount = rule.config.max_count || 5;
  const { schedule, shifts } = context;

  // Группируем по дате
  const dateGroups = groupByDate(schedule);

  for (const [dateKey, entries] of Object.entries(dateGroups)) {
    // Считаем только записи с рабочими сменами
    const workingEmployees = entries.filter(entry => {
      const shift = shifts.find(s => s.id === entry.shiftId);
      return shift && shift.hours > 0;
    });

    if (workingEmployees.length > maxCount) {
      const [year, month, day] = dateKey.split('-').map(Number);
      violations.push({
        type: rule.ruleType,
        severity: rule.enforcementType || 'warning',
        message: rule.customMessage ||
          `${formatDate(year, month, day)}: ${workingEmployees.length} сотрудников (макс: ${maxCount})`,
        date: formatDate(year, month, day),
        metadata: { currentCount: workingEmployees.length, maxCount },
      });
    }
  }

  return violations;
}

/**
 * Проверка максимального количества рабочих дней подряд
 */
function validateMaxConsecutiveWorkDays(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const maxDays = rule.config.max_days || 6;
  const { schedule, employees, shifts } = context;

  const employeeSchedules = groupByEmployee(schedule);

  for (const [employeeId, entries] of Object.entries(employeeSchedules)) {
    if (!isRuleApplicable(rule, employeeId, employees)) {
      continue;
    }

    const employee = employees.find(e => e.id === employeeId);
    if (!employee) continue;

    const sortedEntries = sortByDate(entries);
    let consecutiveDays = 0;

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      const shift = shifts.find(s => s.id === entry.shiftId);

      if (shift && shift.hours > 0) {
        consecutiveDays++;

        if (consecutiveDays > maxDays) {
          violations.push({
            type: rule.ruleType,
            severity: rule.enforcementType || 'warning',
            message: rule.customMessage ||
              `${employee.name}: ${consecutiveDays} рабочих дней подряд (макс: ${maxDays})`,
            employeeId,
            date: formatDate(entry.year, entry.month, entry.day),
            metadata: { consecutiveDays, maxDays },
          });
        }
      } else {
        consecutiveDays = 0;
      }
    }
  }

  return violations;
}

/**
 * Проверка максимального количества выходных дней подряд
 */
function validateMaxConsecutiveDaysOff(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const maxDays = rule.config.max_days || 3;
  const { schedule, employees, shifts, month, year } = context;

  const employeeSchedules = groupByEmployee(schedule);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (const [employeeId, entries] of Object.entries(employeeSchedules)) {
    if (!isRuleApplicable(rule, employeeId, employees)) {
      continue;
    }

    const employee = employees.find(e => e.id === employeeId);
    if (!employee) continue;

    // Создаем карту дней с рабочими сменами
    const workDaysSet = new Set<number>();
    entries.forEach(entry => {
      const shift = shifts.find(s => s.id === entry.shiftId);
      if (shift && shift.hours > 0) {
        workDaysSet.add(entry.day);
      }
    });

    // Проверяем последовательности выходных
    let consecutiveDaysOff = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (!workDaysSet.has(day)) {
        consecutiveDaysOff++;

        if (consecutiveDaysOff > maxDays) {
          violations.push({
            type: rule.ruleType,
            severity: rule.enforcementType || 'warning',
            message: rule.customMessage ||
              `${employee.name}: ${consecutiveDaysOff} выходных дней подряд (макс: ${maxDays})`,
            employeeId,
            date: formatDate(year, month, day),
            metadata: { consecutiveDaysOff, maxDays },
          });
        }
      } else {
        consecutiveDaysOff = 0;
      }
    }
  }

  return violations;
}

/**
 * Проверяет, применяется ли правило к конкретному сотруднику
 */
function isRuleApplicable(
  rule: ValidationRule,
  employeeId: string,
  employees: Employee[]
): boolean {
  // Если указаны конкретные сотрудники
  if (rule.appliesToEmployees && rule.appliesToEmployees.length > 0) {
    return rule.appliesToEmployees.includes(employeeId);
  }

  // Если указаны роли
  if (rule.appliesToRoles && rule.appliesToRoles.length > 0) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee || !employee.role) return false;

    // Проверяем по имени роли (legacy compatibility)
    const roleName = employee.role.name?.toLowerCase();
    return rule.appliesToRoles.some(r => r.toLowerCase() === roleName);
  }

  // Правило применяется ко всем
  return true;
}

/**
 * Группирует записи графика по сотрудникам
 */
function groupByEmployee(schedule: ScheduleEntry[]): Record<string, ScheduleEntry[]> {
  return schedule.reduce((acc, entry) => {
    if (!acc[entry.employeeId]) {
      acc[entry.employeeId] = [];
    }
    acc[entry.employeeId].push(entry);
    return acc;
  }, {} as Record<string, ScheduleEntry[]>);
}

/**
 * Группирует записи графика по датам
 */
function groupByDate(schedule: ScheduleEntry[]): Record<string, ScheduleEntry[]> {
  return schedule.reduce((acc, entry) => {
    const key = `${entry.year}-${entry.month}-${entry.day}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(entry);
    return acc;
  }, {} as Record<string, ScheduleEntry[]>);
}

/**
 * Сортирует записи по дате
 */
function sortByDate(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries.sort((a, b) => {
    const dateA = new Date(a.year, a.month, a.day).getTime();
    const dateB = new Date(b.year, b.month, b.day).getTime();
    return dateA - dateB;
  });
}

/**
 * Проверка максимального количества сотрудников в смене по типу
 */
function validateMaxEmployeesPerShiftType(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const shiftLimits = rule.config.shift_limits || {};
  const { schedule, employees, shifts } = context;

  // Группируем по дате и типу смены
  const dateShiftGroups: Record<string, Record<string, number>> = {};

  schedule.forEach(entry => {
    const shift = shifts.find(s => s.id === entry.shiftId);
    if (!shift || shift.hours === 0) return; // Пропускаем выходные

    const dateKey = `${entry.year}-${entry.month}-${entry.day}`;
    if (!dateShiftGroups[dateKey]) {
      dateShiftGroups[dateKey] = {};
    }
    dateShiftGroups[dateKey][shift.id] = (dateShiftGroups[dateKey][shift.id] || 0) + 1;
  });

  for (const [dateKey, shiftCounts] of Object.entries(dateShiftGroups)) {
    const [year, month, day] = dateKey.split('-').map(Number);

    for (const [shiftId, count] of Object.entries(shiftCounts)) {
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) continue;

      const maxAllowed = shiftLimits[shiftId];
      if (maxAllowed && count > maxAllowed) {
        violations.push({
          type: rule.ruleType,
          severity: rule.enforcementType || 'warning',
          message: rule.customMessage ||
            `${formatDate(year, month, day)}: ${count} сотрудников на смене "${shift.name}" (макс: ${maxAllowed})`,
          date: formatDate(year, month, day),
          metadata: { shiftId: shift.name, count, maxAllowed },
        });
      }
    }
  }

  return violations;
}

/**
 * Проверка требований к менеджерам
 */
function validateManagerRequirements(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const minManagers = rule.config.min_managers_per_day || 1;
  const { schedule, employees, shifts } = context;

  const dateGroups = groupByDate(schedule);

  for (const [dateKey, entries] of Object.entries(dateGroups)) {
    const [year, month, day] = dateKey.split('-').map(Number);

    // Считаем менеджеров на сменах
    const managerCount = entries.filter(entry => {
      const employee = employees.find(e => e.id === entry.employeeId);
      const shift = shifts.find(s => s.id === entry.shiftId);
      return employee && shift && shift.hours > 0 && isManager(employee);
    }).length;

    if (managerCount < minManagers) {
      violations.push({
        type: rule.ruleType,
        severity: rule.enforcementType || 'error',
        message: rule.customMessage ||
          `${formatDate(year, month, day)}: Недостаточно менеджеров (${managerCount} из ${minManagers})`,
        date: formatDate(year, month, day),
        metadata: { managerCount, minManagers },
      });
    }
  }

  return violations;
}

/**
 * Проверка максимального количества часов в месяц
 */
function validateMaxTotalHours(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const maxHours = rule.config.max_hours_per_month || 176;
  const { schedule, employees, shifts } = context;

  // Группируем по сотрудникам
  const employeeSchedules = groupByEmployee(schedule);

  for (const [employeeId, entries] of Object.entries(employeeSchedules)) {
    if (!isRuleApplicable(rule, employeeId, employees)) {
      continue;
    }

    const employee = employees.find(e => e.id === employeeId);
    if (!employee || employee.excludeFromHours) continue;

    // Считаем общее количество часов
    const totalHours = entries.reduce((sum, entry) => {
      const shift = shifts.find(s => s.id === entry.shiftId);
      return sum + (shift?.hours || 0);
    }, 0);

    if (totalHours > maxHours) {
      violations.push({
        type: rule.ruleType,
        severity: rule.enforcementType || 'warning',
        message: rule.customMessage ||
          `${employee.name}: ${totalHours} часов в месяце (макс: ${maxHours})`,
        employeeId,
        metadata: { totalHours, maxHours },
      });
    }
  }

  return violations;
}

/**
 * Проверка лимита часов без менеджеров
 */
function validateMaxHoursWithoutManagers(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const maxHours = rule.config.max_hours_per_month || 100;
  const { schedule, employees, shifts } = context;

  const dateGroups = groupByDate(schedule);

  for (const [dateKey, entries] of Object.entries(dateGroups)) {
    const [year, month, day] = dateKey.split('-').map(Number);

    // Проверяем, есть ли на смене менеджеры
    const hasManager = entries.some(entry => {
      const employee = employees.find(e => e.id === entry.employeeId);
      return employee && isManager(employee);
    });

    // Если менеджеров нет, добавляем часы всех сотрудников
    if (!hasManager) {
      entries.forEach(entry => {
        const shift = shifts.find(s => s.id === entry.shiftId);
        if (shift && shift.hours > 0) {
          violations.push({
            type: rule.ruleType,
            severity: rule.enforcementType || 'warning',
            message: rule.customMessage ||
              `${formatDate(year, month, day)}: Смена без менеджеров (${shift.hours} часов)`,
            date: formatDate(year, month, day),
            metadata: { hours: shift.hours, maxHours },
          });
        }
      });
    }
  }

  return violations;
}

/**
 * Проверка лимита часов для конкретного сотрудника
 */
function validateEmployeeHoursLimit(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const minHours = rule.config.min_hours || 0;
  const maxHours = rule.config.max_hours || 176;
  const enforcement = rule.config.enforcement || 'exact';
  const { schedule, employees, shifts } = context;

  const employeeSchedules = groupByEmployee(schedule);

  for (const [employeeId, entries] of Object.entries(employeeSchedules)) {
    if (!isRuleApplicable(rule, employeeId, employees)) {
      continue;
    }

    const employee = employees.find(e => e.id === employeeId);
    if (!employee || employee.excludeFromHours) continue;

    const totalHours = entries.reduce((sum, entry) => {
      const shift = shifts.find(s => s.id === entry.shiftId);
      return sum + (shift?.hours || 0);
    }, 0);

    let isViolation = false;
    let message = '';

    if (enforcement === 'exact') {
      isViolation = totalHours !== maxHours;
      if (isViolation) {
        message = rule.customMessage ||
          `${employee.name}: ${totalHours} часов (требуется: ${maxHours})`;
      }
    } else if (enforcement === 'range') {
      isViolation = totalHours < minHours || totalHours > maxHours;
      if (isViolation) {
        message = rule.customMessage ||
          `${employee.name}: ${totalHours} часов (допустимо: ${minHours}-${maxHours})`;
      }
    }

    if (isViolation) {
      violations.push({
        type: rule.ruleType,
        severity: rule.enforcementType || 'warning',
        message,
        employeeId,
        metadata: { totalHours, minHours, maxHours, enforcement },
      });
    }
  }

  return violations;
}

/**
 * Проверка рекомендуемых рабочих дней
 */
function validateRecommendedWorkDays(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const maxConsecutiveDays = rule.config.max_consecutive_days || 6;
  const { schedule, employees, shifts, month, year } = context;

  const employeeSchedules = groupByEmployee(schedule);

  for (const [employeeId, entries] of Object.entries(employeeSchedules)) {
    if (!isRuleApplicable(rule, employeeId, employees)) {
      continue;
    }

    const employee = employees.find(e => e.id === employeeId);
    if (!employee) continue;

    const sortedEntries = sortByDate(entries);
    let consecutiveDays = 0;

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      const shift = shifts.find(s => s.id === entry.shiftId);

      if (shift && shift.hours > 0) {
        consecutiveDays++;

        if (consecutiveDays > maxConsecutiveDays) {
          violations.push({
            type: rule.ruleType,
            severity: rule.enforcementType || 'info',
            message: rule.customMessage ||
              `${employee.name}: Рекомендуется не более ${maxConsecutiveDays} рабочих дней подряд (сейчас: ${consecutiveDays})`,
            employeeId,
            date: formatDate(entry.year, entry.month, entry.day),
            metadata: { consecutiveDays, maxConsecutiveDays },
          });
        }
      } else {
        consecutiveDays = 0;
      }
    }
  }

  return violations;
}

/**
 * Проверка обязательных рабочих дней недели
 */
function validateRequiredWorkDays(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const requiredDays = rule.config.days_of_week || []; // 0=воскресенье, 1=понедельник, ...
  const appliesTo = rule.config.applies_to || 'all';
  const { schedule, employees, shifts, month, year } = context;

  if (requiredDays.length === 0) return violations;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateGroups = groupByDate(schedule);

  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = getDayOfWeek(year, month, day);

    if (!requiredDays.includes(dayOfWeek)) continue;

    const dateKey = `${year}-${month}-${day}`;
    const dayEntries = dateGroups[dateKey] || [];

    // Считаем рабочих сотрудников
    const workingEmployees = dayEntries.filter(entry => {
      const shift = shifts.find(s => s.id === entry.shiftId);
      return shift && shift.hours > 0;
    });

    if (workingEmployees.length === 0) {
      violations.push({
        type: rule.ruleType,
        severity: rule.enforcementType || 'error',
        message: rule.customMessage ||
          `${formatDate(year, month, day)}: Обязательный рабочий день без сотрудников`,
        date: formatDate(year, month, day),
        metadata: { dayOfWeek, requiredDays },
      });
    }
  }

  return violations;
}

/**
 * Проверка покрытия по времени
 */
function validateCoverageByTime(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const timeRanges = rule.config.time_ranges || [];
  const minEmployees = rule.config.min_employees || 1;
  const appliesToWeekdays = rule.config.applies_to_weekdays !== false;
  const appliesToWeekends = rule.config.applies_to_weekends !== false;
  const { schedule, employees, shifts, month, year } = context;

  if (timeRanges.length === 0) return violations;

  const dateGroups = groupByDate(schedule);

  for (const [dateKey, entries] of Object.entries(dateGroups)) {
    const [yearNum, monthNum, day] = dateKey.split('-').map(Number);
    const dayOfWeek = getDayOfWeek(yearNum, monthNum, day);
    const isWeekendDay = isWeekend(yearNum, monthNum, day);

    // Проверяем, применяется ли правило к этому дню
    if ((isWeekendDay && !appliesToWeekends) || (!isWeekendDay && !appliesToWeekdays)) {
      continue;
    }

    // Проверяем каждый временной диапазон
    for (const timeRange of timeRanges) {
      const startMinutes = timeToMinutes(timeRange.start_time);
      const endMinutes = timeToMinutes(timeRange.end_time);

      // Считаем сотрудников, работающих в этом диапазоне
      const employeesInRange = entries.filter(entry => {
        const shift = shifts.find(s => s.id === entry.shiftId);
        if (!shift || !shift.startTime || !shift.endTime) return false;

        const shiftStart = timeToMinutes(shift.startTime);
        const shiftEnd = timeToMinutes(shift.endTime);

        // Проверяем пересечение временных диапазонов
        return shiftStart < endMinutes && shiftEnd > startMinutes;
      });

      if (employeesInRange.length < minEmployees) {
        violations.push({
          type: rule.ruleType,
          severity: rule.enforcementType || 'warning',
          message: rule.customMessage ||
            `${formatDate(yearNum, monthNum, day)}: Недостаточно сотрудников в период ${timeRange.start_time}-${timeRange.end_time} (${employeesInRange.length} из ${minEmployees})`,
          date: formatDate(yearNum, monthNum, day),
          metadata: {
            timeRange: `${timeRange.start_time}-${timeRange.end_time}`,
            employeesInRange: employeesInRange.length,
            minEmployees
          },
        });
      }
    }
  }

  return violations;
}

/**
 * Проверка покрытия по дням
 */
function validateCoverageByDay(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const specificDays = rule.config.specific_days || [];
  const minEmployees = rule.config.min_employees || 1;
  const dayType = rule.config.day_type || 'specific';
  const { schedule, employees, shifts, month, year } = context;

  const dateGroups = groupByDate(schedule);

  if (dayType === 'specific' && specificDays.length > 0) {
    // Проверяем конкретные даты
    specificDays.forEach((dateStr: string) => {
      const [checkYear, checkMonth, checkDay] = dateStr.split('-').map(Number);

      // Пропускаем, если дата не в текущем месяце
      if (checkYear !== year || checkMonth !== month + 1) return;

      const dateKey = `${checkYear}-${checkMonth - 1}-${checkDay}`;
      const dayEntries = dateGroups[dateKey] || [];

      const workingEmployees = dayEntries.filter(entry => {
        const shift = shifts.find(s => s.id === entry.shiftId);
        return shift && shift.hours > 0;
      });

      if (workingEmployees.length < minEmployees) {
        violations.push({
          type: rule.ruleType,
          severity: rule.enforcementType || 'error',
          message: rule.customMessage ||
            `${formatDate(checkYear, checkMonth - 1, checkDay)}: Недостаточно сотрудников (${workingEmployees.length} из ${minEmployees})`,
          date: formatDate(checkYear, checkMonth - 1, checkDay),
          metadata: { workingEmployees: workingEmployees.length, minEmployees },
        });
      }
    });
  } else if (dayType === 'weekdays') {
    // Проверяем все будние дни
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      if (isWeekend(year, month, day)) continue;

      const dateKey = `${year}-${month}-${day}`;
      const dayEntries = dateGroups[dateKey] || [];

      const workingEmployees = dayEntries.filter(entry => {
        const shift = shifts.find(s => s.id === entry.shiftId);
        return shift && shift.hours > 0;
      });

      if (workingEmployees.length < minEmployees) {
        violations.push({
          type: rule.ruleType,
          severity: rule.enforcementType || 'warning',
          message: rule.customMessage ||
            `${formatDate(year, month, day)}: Недостаточно сотрудников в будний день (${workingEmployees.length} из ${minEmployees})`,
          date: formatDate(year, month, day),
          metadata: { workingEmployees: workingEmployees.length, minEmployees },
        });
      }
    }
  } else if (dayType === 'weekends') {
    // Проверяем все выходные дни
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      if (!isWeekend(year, month, day)) continue;

      const dateKey = `${year}-${month}-${day}`;
      const dayEntries = dateGroups[dateKey] || [];

      const workingEmployees = dayEntries.filter(entry => {
        const shift = shifts.find(s => s.id === entry.shiftId);
        return shift && shift.hours > 0;
      });

      if (workingEmployees.length < minEmployees) {
        violations.push({
          type: rule.ruleType,
          severity: rule.enforcementType || 'warning',
          message: rule.customMessage ||
            `${formatDate(year, month, day)}: Недостаточно сотрудников в выходной день (${workingEmployees.length} из ${minEmployees})`,
          date: formatDate(year, month, day),
          metadata: { workingEmployees: workingEmployees.length, minEmployees },
        });
      }
    }
  }

  return violations;
}

/**
 * Проверка лимита типа смены в день
 */
function validateShiftTypeLimitPerDay(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const shiftLimits = rule.config.shift_limits || {};
  const { schedule, employees, shifts } = context;

  const dateGroups = groupByDate(schedule);

  for (const [dateKey, entries] of Object.entries(dateGroups)) {
    const [year, month, day] = dateKey.split('-').map(Number);

    // Группируем записи по типам смен
    const shiftTypeCounts: Record<string, number> = {};

    entries.forEach(entry => {
      const shift = shifts.find(s => s.id === entry.shiftId);
      if (!shift) return;

      // Используем abbreviation или id как идентификатор типа
      const typeId = shift.abbreviation || shift.id;
      shiftTypeCounts[typeId] = (shiftTypeCounts[typeId] || 0) + 1;
    });

    // Проверяем лимиты для каждого типа смены
    for (const [typeId, count] of Object.entries(shiftTypeCounts)) {
      const limit = shiftLimits[typeId];
      if (limit && count > limit) {
        violations.push({
          type: rule.ruleType,
          severity: rule.enforcementType || 'warning',
          message: rule.customMessage ||
            `${formatDate(year, month, day)}: ${count} смен типа "${typeId}" (макс: ${limit})`,
          date: formatDate(year, month, day),
          metadata: { shiftType: typeId, count, limit },
        });
      }
    }
  }

  return violations;
}

/**
 * Проверка обязательного покрытия
 */
function validateRequiredCoverage(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const rules = rule.config.rules || [];
  const { schedule, employees, shifts, month, year } = context;

  const dateGroups = groupByDate(schedule);

  for (const coverageRule of rules) {
    const { shift_id, date_pattern, min_employees } = coverageRule;

    if (!shift_id || !date_pattern || min_employees === undefined) continue;

    // Для простоты поддерживаем формат YYYY-MM-DD для date_pattern
    if (date_pattern.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [patternYear, patternMonth, patternDay] = date_pattern.split('-').map(Number);

      // Пропускаем, если дата не в текущем месяце
      if (patternYear !== year || patternMonth !== month + 1) continue;

      const dateKey = `${patternYear}-${patternMonth - 1}-${patternDay}`;
      const dayEntries = dateGroups[dateKey] || [];

      const matchingEmployees = dayEntries.filter(entry => {
        return entry.shiftId === shift_id;
      });

      if (matchingEmployees.length < min_employees) {
        const shift = shifts.find(s => s.id === shift_id);
        const shiftName = shift ? shift.name : shift_id;

        violations.push({
          type: rule.ruleType,
          severity: rule.enforcementType || 'error',
          message: rule.customMessage ||
            `${formatDate(patternYear, patternMonth - 1, patternDay)}: Недостаточно сотрудников на смене "${shiftName}" (${matchingEmployees.length} из ${min_employees})`,
          date: formatDate(patternYear, patternMonth - 1, patternDay),
          metadata: { shiftId: shiftName, employees: matchingEmployees.length, required: min_employees },
        });
      }
    }
  }

  return violations;
}

/**
 * Проверка выходного дня для конкретного сотрудника
 */
function validateEmployeeDayOff(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const { employeeId, specificDate } = rule.config;
  const { schedule, employees, shifts } = context;

  if (!employeeId || !specificDate) return violations;

  // Парсим дату из формата YYYY-MM-DD
  const [year, month, day] = specificDate.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return violations;

  // Ищем запись в расписании для этого сотрудника на эту дату
  const scheduleEntry = schedule.find(entry =>
    entry.employeeId === employeeId &&
    entry.year === year &&
    entry.month === month - 1 && // JavaScript месяцы 0-11
    entry.day === day
  );

  if (scheduleEntry) {
    const employee = employees.find(e => e.id === employeeId);
    const shift = shifts.find(s => s.id === scheduleEntry.shiftId);

    violations.push({
      type: rule.ruleType,
      severity: rule.enforcementType || 'error',
      message: rule.customMessage ||
        `${formatDate(year, month - 1, day)}: У сотрудника ${employee?.name || 'Unknown'} назначена смена "${shift?.name || 'Unknown'}" в выходной день`,
      date: formatDate(year, month - 1, day),
      employeeId,
      metadata: {
        employeeName: employee?.name,
        shiftName: shift?.name,
        shiftId: scheduleEntry.shiftId
      },
    });
  }

  return violations;
}

/**
 * Получает день недели (0=воскресенье, 1=понедельник, ...)
 */
function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month, day).getDay();
}

/**
 * Проверяет, является ли день выходным (суббота или воскресенье)
 */
function isWeekend(year: number, month: number, day: number): boolean {
  const dayOfWeek = getDayOfWeek(year, month, day);
  return dayOfWeek === 0 || dayOfWeek === 6; // 0=воскресенье, 6=суббота
}

/**
 * Проверяет, имеет ли сотрудник роль менеджера
 */
function isManager(employee: Employee): boolean {
  if (!employee.role || !employee.role.permissions) return false;
  return !!(employee.role.permissions.manage_schedule || employee.role.permissions.approve_preferences);
}

/**
 * Проверка одобренных запросов выходных дней
 */
function validateApprovedDayOffRequests(
  rule: ValidationRule,
  context: ValidationContext
): ValidationViolation[] {
  const violations: ValidationViolation[] = [];
  const { schedule, employees, shifts, approvedDayOffs } = context;

  if (!approvedDayOffs || approvedDayOffs.length === 0) {
    return violations;
  }

  for (const dayOff of approvedDayOffs) {
    // Ищем запись в расписании для этого сотрудника на эту дату
    const scheduleEntry = schedule.find(entry => {
      const entryDate = formatDate(entry.year, entry.month, entry.day);
      return entry.employeeId === dayOff.employeeId && entryDate === dayOff.date;
    });

    if (scheduleEntry) {
      const employee = employees.find(e => e.id === dayOff.employeeId);
      const shift = shifts.find(s => s.id === scheduleEntry.shiftId);

      // Проверяем, что это не выходная смена
      if (shift && shift.hours > 0) {
        violations.push({
          type: rule.ruleType,
          severity: rule.enforcementType || 'error',
          message: rule.customMessage ||
            `${dayOff.date}: У сотрудника ${employee?.name || 'Unknown'} назначена рабочая смена "${shift?.name || 'Unknown'}" в одобренный выходной день`,
          date: dayOff.date,
          employeeId: dayOff.employeeId,
          metadata: {
            employeeName: employee?.name,
            shiftName: shift?.name,
            shiftId: scheduleEntry.shiftId,
            dayOffRequest: true
          },
        });
      }
    }
  }

  return violations;
}

/**
 * Преобразует время в формате HH:MM в минуты
 */
function timeToMinutes(time?: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
