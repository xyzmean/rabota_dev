import { Request, Response } from 'express';
import { pool } from '../config/database';
import { validationResult } from 'express-validator';

// Типы для правил валидации
interface ValidationRule {
  id: number;
  rule_type: string;
  enabled: boolean;
  config: any;
  applies_to_roles: string[] | null;
  priority: number;
  description: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  exclude_from_hours: boolean;
}

interface Shift {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  hours: number;
  start_time?: string;
  end_time?: string;
  is_default: boolean;
}

interface ScheduleEntry {
  employee_id: string;
  day: number;
  month: number;
  year: number;
  shift_id: string;
}

// Основная функция генерации графика
export const generateSchedule = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ error: 'Месяц и год обязательны' });
    }

    // Получаем данные
    const [employees, shifts, validationRules] = await Promise.all([
      getEmployees(),
      getShifts(),
      getValidationRules()
    ]);

    // Проверяем наличие выходной смены
    const dayOffShift = shifts.find(s => s.id === 'day-off');
    if (!dayOffShift) {
      return res.status(400).json({ error: 'Смена "Выходной" не найдена в системе' });
    }

    // Получаем количество дней в месяце
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Очищаем существующий график за указанный месяц
    await clearExistingSchedule(month, year);

    // Генерируем график
    const generatedSchedule = await generateOptimalSchedule(
      employees,
      shifts,
      validationRules,
      month,
      year,
      daysInMonth
    );

    // Сохраняем в базу данных
    await saveSchedule(generatedSchedule);

    res.json({
      success: true,
      message: `График сгенерирован за ${month + 1}/${year}`,
      schedule: generatedSchedule.length
    });

  } catch (error) {
    console.error('Ошибка при генерации графика:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
};

// Получаем всех сотрудников
async function getEmployees(): Promise<Employee[]> {
  const query = 'SELECT * FROM employees ORDER BY name';
  const result = await pool.query(query);
  return result.rows;
}

// Получаем все смены
async function getShifts(): Promise<Shift[]> {
  const query = 'SELECT * FROM shifts ORDER BY id';
  const result = await pool.query(query);
  return result.rows;
}

// Получаем включенные правила валидации, отсортированные по приоритету
async function getValidationRules(): Promise<ValidationRule[]> {
  const query = `
    SELECT * FROM validation_rules
    WHERE enabled = true
    ORDER BY priority DESC, id ASC
  `;
  const result = await pool.query(query);
  return result.rows;
}

// Очищаем существующий график
async function clearExistingSchedule(month: number, year: number) {
  const query = 'DELETE FROM schedule WHERE month = $1 AND year = $2';
  await pool.query(query, [month, year]);
}

// Генерируем оптимальный график
async function generateOptimalSchedule(
  employees: Employee[],
  shifts: Shift[],
  validationRules: ValidationRule[],
  month: number,
  year: number,
  daysInMonth: number
): Promise<ScheduleEntry[]> {
  const schedule: ScheduleEntry[] = [];
  const workingShifts = shifts.filter(s => s.id !== 'day-off');

  // Определяем выходные дни (суббота и воскресенье)
  const weekendDays = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Воскресенье или суббота
      weekendDays.push(day);
    }
  }

  // Сначала заполняем выходные дни
  for (const employee of employees) {
    for (const day of weekendDays) {
      schedule.push({
        employee_id: employee.id,
        day,
        month,
        year,
        shift_id: 'day-off'
      });
    }
  }

  // Для каждого дня месяца генерируем оптимальное распределение
  for (let day = 1; day <= daysInMonth; day++) {
    if (weekendDays.includes(day)) continue; // Пропускаем выходные

    const daySchedule = generateDaySchedule(
      day,
      month,
      year,
      employees,
      workingShifts,
      validationRules,
      schedule
    );

    schedule.push(...daySchedule);
  }

  return schedule;
}

// Генерируем расписание для одного дня
function generateDaySchedule(
  day: number,
  month: number,
  year: number,
  employees: Employee[],
  shifts: Shift[],
  validationRules: ValidationRule[],
  existingSchedule: ScheduleEntry[]
): ScheduleEntry[] {
  const daySchedule: ScheduleEntry[] = [];

  // Получаем уже запланированных сотрудников на этот день
  const plannedEmployees = existingSchedule
    .filter(s => s.day === day && s.month === month && s.year === year)
    .map(s => s.employee_id);

  // Доступные сотрудники для этого дня
  const availableEmployees = employees.filter(e => !plannedEmployees.includes(e.id));

  if (availableEmployees.length === 0 || shifts.length === 0) {
    return daySchedule;
  }

  // Генерируем все возможные варианты распределения смен
  const variants = generateScheduleVariants(availableEmployees, shifts, day, month, year);

  if (variants.length === 0) {
    return daySchedule;
  }

  // Оцениваем каждый вариант по правилам валидации
  const scoredVariants = variants.map(variant => ({
    variant,
    score: calculateVariantScore(variant, validationRules, existingSchedule)
  }));

  // Сортируем по убыванию оценки (самый высокий приоритет правил)
  scoredVariants.sort((a, b) => b.score - a.score);

  // Выбираем лучший вариант
  const bestVariant = scoredVariants[0]?.variant || [];

  return bestVariant;
}

// Генерируем все возможные варианты распределения смен
function generateScheduleVariants(
  employees: Employee[],
  shifts: Shift[],
  day: number,
  month: number,
  year: number
): ScheduleEntry[][] {
  const variants: ScheduleEntry[][] = [];

  // Простой алгоритм: каждому сотруднику по одной смене
  if (employees.length > 0 && shifts.length > 0) {
    const variant: ScheduleEntry[] = [];

    // Распределяем смены по сотрудникам циклически
    for (let i = 0; i < employees.length; i++) {
      const shiftIndex = i % shifts.length;
      variant.push({
        employee_id: employees[i].id,
        day,
        month,
        year,
        shift_id: shifts[shiftIndex].id
      });
    }

    variants.push(variant);
  }

  return variants;
}

// Рассчитываем оценку варианта по правилам валидации
function calculateVariantScore(
  variant: ScheduleEntry[],
  validationRules: ValidationRule[],
  existingSchedule: ScheduleEntry[]
): number {
  let score = 0;

  // Создаем временный полный график для проверки
  const tempSchedule = [...existingSchedule, ...variant];

  for (const rule of validationRules) {
    const ruleScore = evaluateRule(rule, tempSchedule, variant);
    // Чем выше приоритет правила, тем больше его вклад в общую оценку
    score += ruleScore * rule.priority;
  }

  return score;
}

// Оцениваем выполнение одного правила
function evaluateRule(
  rule: ValidationRule,
  fullSchedule: ScheduleEntry[],
  currentVariant: ScheduleEntry[]
): number {
  try {
    switch (rule.rule_type) {
      case 'min_employees_per_shift':
        return evaluateMinEmployeesPerShift(rule, fullSchedule);
      case 'max_employees_per_shift':
        return evaluateMaxEmployeesPerShift(rule, fullSchedule);
      case 'max_consecutive_work_days':
        return evaluateMaxConsecutiveWorkDays(rule, fullSchedule);
      case 'max_consecutive_shifts':
        return evaluateMaxConsecutiveShifts(rule, fullSchedule);
      case 'required_work_days':
        return evaluateRequiredWorkDays(rule, currentVariant);
      default:
        return 0;
    }
  } catch (error) {
    console.error(`Ошибка при оценке правила ${rule.rule_type}:`, error);
    return 0;
  }
}

// Оценка правила минимального количества сотрудников в смене
function evaluateMinEmployeesPerShift(
  rule: ValidationRule,
  schedule: ScheduleEntry[]
): number {
  const { min_employees, shift_ids } = rule.config;
  let satisfiedCount = 0;
  let totalCount = 0;

  for (const shiftId of shift_ids || []) {
    const shiftEmployees = schedule.filter(s => s.shift_id === shiftId);
    totalCount++;
    if (shiftEmployees.length >= min_employees) {
      satisfiedCount++;
    }
  }

  return totalCount > 0 ? (satisfiedCount / totalCount) * 100 : 0;
}

// Оценка правила максимального количества сотрудников в смене
function evaluateMaxEmployeesPerShift(
  rule: ValidationRule,
  schedule: ScheduleEntry[]
): number {
  const { max_employees, shift_ids } = rule.config;
  let satisfiedCount = 0;
  let totalCount = 0;

  for (const shiftId of shift_ids || []) {
    const shiftEmployees = schedule.filter(s => s.shift_id === shiftId);
    totalCount++;
    if (shiftEmployees.length <= max_employees) {
      satisfiedCount++;
    }
  }

  return totalCount > 0 ? (satisfiedCount / totalCount) * 100 : 0;
}

// Оценка правила максимального количества рабочих дней подряд
function evaluateMaxConsecutiveWorkDays(
  rule: ValidationRule,
  schedule: ScheduleEntry[]
): number {
  const { max_days } = rule.config;
  const employeeWorkDays = new Map<string, number[]>();

  // Группируем рабочие дни по сотрудникам
  for (const entry of schedule) {
    if (entry.shift_id !== 'day-off') {
      if (!employeeWorkDays.has(entry.employee_id)) {
        employeeWorkDays.set(entry.employee_id, []);
      }
      employeeWorkDays.get(entry.employee_id)!.push(entry.day);
    }
  }

  let satisfiedCount = 0;
  let totalCount = 0;

  for (const [employeeId, days] of employeeWorkDays) {
    totalCount++;
    days.sort((a, b) => a - b);

    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let lastDay = 0;

    for (const day of days) {
      if (day === lastDay + 1) {
        currentConsecutive++;
      } else {
        currentConsecutive = 1;
      }
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      lastDay = day;
    }

    if (maxConsecutive <= max_days) {
      satisfiedCount++;
    }
  }

  return totalCount > 0 ? (satisfiedCount / totalCount) * 100 : 0;
}

// Оценка правила максимального количества смен подряд
function evaluateMaxConsecutiveShifts(
  rule: ValidationRule,
  schedule: ScheduleEntry[]
): number {
  // По сути то же самое, что и рабочие дни подряд
  return evaluateMaxConsecutiveWorkDays(rule, schedule);
}

// Оценка обязательных рабочих дней
function evaluateRequiredWorkDays(
  rule: ValidationRule,
  variant: ScheduleEntry[]
): number {
  const { required_days } = rule.config; // дни недели: 0-вс, 1-пн, ..., 6-сб

  for (const entry of variant) {
    const date = new Date(entry.year, entry.month, entry.day);
    const dayOfWeek = date.getDay();

    if (required_days.includes(dayOfWeek) && entry.shift_id === 'day-off') {
      return 0; // Нарушение правила
    }
  }

  return 100; // Правило выполнено
}

// Сохраняем график в базу данных
async function saveSchedule(schedule: ScheduleEntry[]) {
  if (schedule.length === 0) return;

  const query = `
    INSERT INTO schedule (employee_id, day, month, year, shift_id)
    VALUES ($1, $2, $3, $4, $5)
  `;

  for (const entry of schedule) {
    await pool.query(query, [
      entry.employee_id,
      entry.day,
      entry.month,
      entry.year,
      entry.shift_id
    ]);
  }
}