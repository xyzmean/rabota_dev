import { Request, Response } from 'express';
import pool from '../config/database';
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
    const [employees, shifts, validationRules, approvedDayOffs] = await Promise.all([
      getEmployees(),
      getShifts(),
      getValidationRules(),
      getApprovedDayOffs(month, year)
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
      daysInMonth,
      approvedDayOffs
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

// Получаем одобренные запросы выходных дней
async function getApprovedDayOffs(month: number, year: number): Promise<Array<{employeeId: string, date: string}>> {
  const query = `
    SELECT employee_id as "employeeId", target_date as "date"
    FROM employee_preferences
    WHERE preference_type = 'day_off'
      AND status = 'approved'
      AND EXTRACT(MONTH FROM target_date) = $1
      AND EXTRACT(YEAR FROM target_date) = $2
  `;
  const result = await pool.query(query, [month + 1, year]); // SQL месяцы 1-12, JavaScript 0-11
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
  daysInMonth: number,
  approvedDayOffs: Array<{employeeId: string, date: string}> = []
): Promise<ScheduleEntry[]> {
  const schedule: ScheduleEntry[] = [];
  const workingShifts = shifts.filter(s => s.id !== 'day-off');

  // Создаем множества для быстрой проверки одобренных выходных
  const approvedDayOffsSet = new Map<string, Set<string>>();
  for (const dayOff of approvedDayOffs) {
    if (!approvedDayOffsSet.has(dayOff.employeeId)) {
      approvedDayOffsSet.set(dayOff.employeeId, new Set());
    }
    approvedDayOffsSet.get(dayOff.employeeId)!.add(dayOff.date);
  }

  // Добавляем только одобренные выходные дни (не делаем автоматических выходных в сб/вс)
  for (const employee of employees) {
    for (const dayOff of approvedDayOffs) {
      if (dayOff.employeeId === employee.id) {
        // Преобразуем дату в строку формата YYYY-MM-DD
        let dateStr: string;
        const dateValue = dayOff.date as any;
        if (dateValue instanceof Date) {
          dateStr = dateValue.toISOString().split('T')[0];
        } else if (typeof dateValue === 'string') {
          dateStr = dayOff.date;
        } else {
          dateStr = String(dateValue);
        }

        const [offYear, offMonth, offDay] = dateStr.split('-').map(Number);
        if (offYear === year && offMonth === month + 1) { // +1 т.к. SQL месяцы 1-12
          schedule.push({
            employee_id: employee.id,
            day: offDay,
            month,
            year,
            shift_id: 'day-off'
          });
        }
      }
    }
  }

  // Для каждого дня месяца генерируем оптимальное распределение
  for (let day = 1; day <= daysInMonth; day++) {
    // Проверяем, есть ли одобренные выходные на этот день
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const employeesWithDayOff = new Set<string>();
    for (const dayOff of approvedDayOffs) {
      if (dayOff.date === dateStr) {
        employeesWithDayOff.add(dayOff.employeeId);
      }
    }

    // Фильтруем сотрудников, которые не имеют выходного в этот день
    const availableEmployees = employees.filter(emp => !employeesWithDayOff.has(emp.id));

    if (availableEmployees.length === 0) continue; // Все сотрудники имеют выходной

    // Проверяем, не работает ли сотрудник уже много дней подряд
    const filteredEmployees = availableEmployees.filter(emp => {
      const consecutiveWorkDays = getConsecutiveWorkDays(emp.id, day, schedule);
      // Ищем правило максимальных рабочих дней подряд (объединенные типы)
      const maxConsecutiveRule = validationRules.find(r =>
        r.rule_type === 'max_consecutive_work_days' || r.rule_type === 'max_consecutive_shifts'
      );
      if (maxConsecutiveRule) {
        const maxDays = maxConsecutiveRule.config.max_days || 5;
        return consecutiveWorkDays < maxDays;
      }
      return true;
    });

    // Если после фильтрации никого не осталось, берем всех доступных
    const finalEmployees = filteredEmployees.length > 0 ? filteredEmployees : availableEmployees;

    const daySchedule = generateDaySchedule(
      day,
      month,
      year,
      finalEmployees,
      workingShifts,
      validationRules,
      schedule
    );

    schedule.push(...daySchedule);
  }

  return schedule;
}

// Получаем количество рабочих дней подряд для сотрудника до указанной даты
function getConsecutiveWorkDays(
  employeeId: string,
  currentDay: number,
  schedule: ScheduleEntry[]
): number {
  const employeeEntries = schedule
    .filter(s => s.employee_id === employeeId && s.shift_id !== 'day-off')
    .filter(s => s.day < currentDay)
    .sort((a, b) => b.day - a.day); // Сортируем в обратном порядке

  let consecutiveDays = 0;
  let expectedDay = currentDay - 1;

  for (const entry of employeeEntries) {
    if (entry.day === expectedDay) {
      consecutiveDays++;
      expectedDay--;
    } else {
      break; // Прерывание последовательности
    }
  }

  return consecutiveDays;
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
  const scoredVariants = variants.map(variant => {
    const scoreResult = calculateVariantScore(variant, validationRules, existingSchedule);
    return {
      variant,
      score: scoreResult.score,
      ruleResults: scoreResult.ruleResults
    };
  });

  // Сортируем по количеству подряд выполненных правил (больше = лучше)
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

  if (employees.length === 0 || shifts.length === 0) {
    return variants;
  }

  const allShifts = [...shifts];
  // Добавляем выходной смену как вариант для генерации
  allShifts.push({ id: 'day-off', name: 'Выходной', abbreviation: 'В', color: '#ef4444', hours: 0, is_default: false });

  // Вариант 1: всем по одной смене, равномерное распределение (без выходных)
  const equalVariant: ScheduleEntry[] = [];
  for (let i = 0; i < employees.length; i++) {
    const shiftIndex = i % shifts.length; // Только рабочие смены
    equalVariant.push({
      employee_id: employees[i].id,
      day,
      month,
      year,
      shift_id: shifts[shiftIndex].id
    });
  }
  variants.push(equalVariant);

  // Вариант 2: равномерное распределение с возможными выходными
  const equalWithDaysOffVariant: ScheduleEntry[] = [];
  for (let i = 0; i < employees.length; i++) {
    const shiftIndex = i % allShifts.length; // Все смены включая выходные
    equalWithDaysOffVariant.push({
      employee_id: employees[i].id,
      day,
      month,
      year,
      shift_id: allShifts[shiftIndex].id
    });
  }
  variants.push(equalWithDaysOffVariant);

  // Вариант 3: первые сотрудники в первую смену, остальные во вторую
  if (shifts.length >= 2 && employees.length >= 2) {
    const firstShiftVariant: ScheduleEntry[] = [];
    const half = Math.ceil(employees.length / 2);

    for (let i = 0; i < employees.length; i++) {
      const shiftId = i < half ? shifts[0].id : shifts[1].id;
      firstShiftVariant.push({
        employee_id: employees[i].id,
        day,
        month,
        year,
        shift_id: shiftId
      });
    }
    variants.push(firstShiftVariant);
  }

  // Вариант 4: часть сотрудников работают, часть выходной
  if (employees.length >= 2) {
    const mixedVariant: ScheduleEntry[] = [];
    const workingCount = Math.ceil(employees.length * 0.7); // 70% работают

    for (let i = 0; i < employees.length; i++) {
      if (i < workingCount && shifts.length > 0) {
        const shiftIndex = i % shifts.length;
        mixedVariant.push({
          employee_id: employees[i].id,
          day,
          month,
          year,
          shift_id: shifts[shiftIndex].id
        });
      } else {
        mixedVariant.push({
          employee_id: employees[i].id,
          day,
          month,
          year,
          shift_id: 'day-off'
        });
      }
    }
    variants.push(mixedVariant);
  }

  // Вариант 5: только одна смена для всех
  if (employees.length <= 4 && shifts.length > 0) {
    for (const shift of shifts) {
      const singleShiftVariant: ScheduleEntry[] = [];
      for (const employee of employees) {
        singleShiftVariant.push({
          employee_id: employee.id,
          day,
          month,
          year,
          shift_id: shift.id
        });
      }
      variants.push(singleShiftVariant);
    }
  }

  // Вариант 6: минимум сотрудников (по 1-2 на смену)
  if (employees.length >= shifts.length) {
    const minimalVariant: ScheduleEntry[] = [];
    for (let i = 0; i < shifts.length && i < employees.length; i++) {
      minimalVariant.push({
        employee_id: employees[i].id,
        day,
        month,
        year,
        shift_id: shifts[i].id
      });
    }
    variants.push(minimalVariant);
  }

  // Вариант 7: чередование через одного
  if (shifts.length >= 2 && employees.length >= 3) {
    const alternatingVariant: ScheduleEntry[] = [];
    for (let i = 0; i < employees.length; i++) {
      const shiftIndex = i % 2 === 0 ? 0 : 1;
      if (shiftIndex < shifts.length) {
        alternatingVariant.push({
          employee_id: employees[i].id,
          day,
          month,
          year,
          shift_id: shifts[shiftIndex].id
        });
      }
    }
    variants.push(alternatingVariant);
  }

  // Удаляем дубликаты
  const uniqueVariants = variants.filter((variant, index, self) => {
    const key = variant.map(entry => `${entry.employee_id}-${entry.shift_id}`).sort().join(',');
    return !self.some((otherVariant, otherIndex) =>
      otherIndex < index &&
      otherVariant.length === variant.length &&
      otherVariant.map(entry => `${entry.employee_id}-${entry.shift_id}`).sort().join(',') === key
    );
  });

  return uniqueVariants;
}

// Рассчитываем оценку варианта по правилам валидации
function calculateVariantScore(
  variant: ScheduleEntry[],
  validationRules: ValidationRule[],
  existingSchedule: ScheduleEntry[]
): { score: number; ruleResults: boolean[] } {
  // Создаем временный полный график для проверки
  const tempSchedule = [...existingSchedule, ...variant];

  // Оцениваем каждое правило по отдельности
  const ruleResults: boolean[] = [];
  for (const rule of validationRules) {
    const isPassed = evaluateRulePass(rule, tempSchedule, variant);
    ruleResults.push(isPassed);
  }

  // Считаем сколько правил подряд выполнено сверху вниз
  let consecutivePasses = 0;
  for (let i = 0; i < ruleResults.length; i++) {
    if (ruleResults[i]) {
      consecutivePasses++;
    } else {
      break;
    }
  }

  // Возвращаем количество подряд выполненных правил и детальные результаты
  return {
    score: consecutivePasses,
    ruleResults
  };
}

// Проверяем выполнение правила (возвращает boolean)
function evaluateRulePass(
  rule: ValidationRule,
  fullSchedule: ScheduleEntry[],
  currentVariant: ScheduleEntry[]
): boolean {
  try {
    switch (rule.rule_type) {
      case 'min_employees_per_shift':
        return evaluateMinEmployeesPerShiftPass(rule, fullSchedule);
      case 'max_employees_per_shift':
        return evaluateMaxEmployeesPerShiftPass(rule, fullSchedule);
      case 'max_consecutive_work_days':
      case 'max_consecutive_shifts':
        // Объединяем эти правила - они делают одно и то же
        return evaluateMaxConsecutiveWorkDaysPass(rule, fullSchedule);
      case 'required_work_days':
        return evaluateRequiredWorkDaysPass(rule, currentVariant);
      default:
        return true; // Неизвестные правила считаем выполненными
    }
  } catch (error) {
    console.error(`Ошибка при оценке правила ${rule.rule_type}:`, error);
    return false;
  }
}

// Оцениваем выполнение одного правила (для совместимости)
function evaluateRule(
  rule: ValidationRule,
  fullSchedule: ScheduleEntry[],
  currentVariant: ScheduleEntry[]
): number {
  return evaluateRulePass(rule, fullSchedule, currentVariant) ? 100 : 0;
}

// Проверка правила минимального количества сотрудников в смене
function evaluateMinEmployeesPerShiftPass(
  rule: ValidationRule,
  schedule: ScheduleEntry[]
): boolean {
  const { min_employees, shift_ids } = rule.config;

  for (const shiftId of shift_ids || []) {
    const shiftEmployees = schedule.filter(s => s.shift_id === shiftId);
    if (shiftEmployees.length < min_employees) {
      return false; // Нарушение правила
    }
  }

  return true; // Все смены удовлетворяют минимуму
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

// Проверка правила максимального количества сотрудников в смене
function evaluateMaxEmployeesPerShiftPass(
  rule: ValidationRule,
  schedule: ScheduleEntry[]
): boolean {
  const { max_employees, shift_ids } = rule.config;

  for (const shiftId of shift_ids || []) {
    const shiftEmployees = schedule.filter(s => s.shift_id === shiftId);
    if (shiftEmployees.length > max_employees) {
      return false; // Нарушение правила
    }
  }

  return true; // Все смены удовлетворяют максимуму
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

// Проверка правила максимального количества рабочих дней подряд
function evaluateMaxConsecutiveWorkDaysPass(
  rule: ValidationRule,
  schedule: ScheduleEntry[]
): boolean {
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

  for (const [employeeId, days] of employeeWorkDays) {
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

    if (maxConsecutive > max_days) {
      return false; // Нарушение правила
    }
  }

  return true; // Все сотрудники удовлетворяют ограничению
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


// Проверка обязательных рабочих дней
function evaluateRequiredWorkDaysPass(
  rule: ValidationRule,
  variant: ScheduleEntry[]
): boolean {
  const { required_days } = rule.config; // дни недели: 0-вс, 1-пн, ..., 6-сб

  for (const entry of variant) {
    const date = new Date(entry.year, entry.month, entry.day);
    const dayOfWeek = date.getDay();

    if (required_days.includes(dayOfWeek) && entry.shift_id === 'day-off') {
      return false; // Нарушение правила
    }
  }

  return true; // Правило выполнено
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

// Полная очистка базы данных
export async function clearAllDatabase() {
  try {
    await pool.query('BEGIN');

    // Очищаем все таблицы в правильном порядке
    await pool.query('DELETE FROM schedule');
    await pool.query('DELETE FROM employee_preferences');
    await pool.query('DELETE FROM preference_reasons');
    await pool.query('DELETE FROM validation_rules');
    await pool.query('DELETE FROM employees');
    await pool.query('DELETE FROM shifts');
    await pool.query('DELETE FROM roles');
    await pool.query('DELETE FROM app_settings');

    // Сбрасываем счетчики
    await pool.query('ALTER SEQUENCE employees_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE shifts_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE roles_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE schedule_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE employee_preferences_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE preference_reasons_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE validation_rules_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE app_settings_id_seq RESTART WITH 1');

    await pool.query('COMMIT');
    return true;
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Ошибка при очистке базы данных:', error);
    throw error;
  }
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