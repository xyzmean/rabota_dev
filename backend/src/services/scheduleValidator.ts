/**
 * Schedule Validation Service
 * Проверяет график работы на соответствие правилам валидации
 */

import { ValidationRule, ScheduleEntry, Employee, Shift } from '../models/types';

interface ValidationViolation {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  employeeId?: string;
  date?: string; // YYYY-MM-DD
  metadata?: Record<string, any>;
}

interface ScheduleValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
}

interface ValidationContext {
  schedule: ScheduleEntry[];
  employees: Employee[];
  shifts: Shift[];
  month: number;
  year: number;
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
    case 'max_consecutive_work_days':
      return validateMaxConsecutiveWorkDays(rule, context);
    case 'max_consecutive_days_off':
      return validateMaxConsecutiveDaysOff(rule, context);
    // Добавьте другие типы правил по необходимости
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
 * Форматирует дату в строку YYYY-MM-DD
 */
function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
