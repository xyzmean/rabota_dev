import { Request, Response } from 'express';
import pool from '../config/database';
import { Employee, Shift, ValidationRule, ScheduleEntry as ModelScheduleEntry } from '../models/types';
import { ValidationContext, evaluateValidationRule } from '../services/scheduleValidator';

interface ScheduleEntry {
  id?: number;
  employee_id: string;
  day: number;
  month: number;
  year: number;
  shift_id: string;
}

type DayOffRequest = {
  employeeId: string;
  date: string;
};

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
  const query = `
    SELECT
      e.id,
      e.name,
      e.exclude_from_hours as "excludeFromHours",
      e.role_id as "roleId",
      r.id as "role.id",
      r.name as "role.name",
      r.permissions as "role.permissions",
      r.color as "role.color",
      r.description as "role.description",
      r.is_system as "role.isSystem"
    FROM employees e
    LEFT JOIN roles r ON e.role_id = r.id
    ORDER BY e.name ASC
  `;
  const result = await pool.query(query);
  return result.rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    excludeFromHours: row.excludeFromHours,
    roleId: row.roleId,
    role: row['role.id']
      ? {
          id: row['role.id'],
          name: row['role.name'],
          permissions: row['role.permissions'],
          color: row['role.color'],
          description: row['role.description'],
          isSystem: row['role.isSystem']
        }
      : undefined
  }));
}

async function getShifts(): Promise<Shift[]> {
  const query = `
    SELECT
      id,
      name,
      abbreviation,
      color,
      hours,
      start_time as "startTime",
      end_time as "endTime",
      is_default as "isDefault"
    FROM shifts
    ORDER BY id
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function getValidationRules(): Promise<ValidationRule[]> {
  const query = `
    SELECT
      id,
      rule_type as "ruleType",
      enabled,
      config,
      applies_to_roles as "appliesToRoles",
      applies_to_employees as "appliesToEmployees",
      priority,
      description,
      enforcement_type as "enforcementType",
      custom_message as "customMessage"
    FROM validation_rules
    WHERE enabled = true
    ORDER BY priority ASC, id ASC
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function getApprovedDayOffs(month: number, year: number): Promise<DayOffRequest[]> {
  const query = `
    SELECT employee_id as "employeeId", target_date as "date"
    FROM employee_preferences
    WHERE preference_type = 'day_off'
      AND status = 'approved'
      AND EXTRACT(MONTH FROM target_date) = $1
      AND EXTRACT(YEAR FROM target_date) = $2
  `;
  const result = await pool.query(query, [month + 1, year]);
  return result.rows.map((row: any) => {
    const rawDate = row.date;
    const dateStr = rawDate instanceof Date
      ? rawDate.toISOString().split('T')[0]
      : typeof rawDate === 'string'
        ? rawDate.split('T')[0]
        : String(rawDate);
    return {
      employeeId: row.employeeId,
      date: dateStr
    };
  });
}

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
  approvedDayOffs: DayOffRequest[] = []
): Promise<ScheduleEntry[]> {
  const schedule: ScheduleEntry[] = [];
  const workingShifts = shifts.filter(s => s.id !== 'day-off');

  // Создаем множества для быстрой проверки одобренных выходных
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
      const consecutiveWorkDays = getConsecutiveWorkDays(emp.id, day, month, year, schedule);
      // Ищем правило максимальных рабочих дней подряд (объединенные типы)
      const maxConsecutiveRule = validationRules.find(r =>
        r.ruleType === 'max_consecutive_work_days' || r.ruleType === 'max_consecutive_shifts'
      );
      if (maxConsecutiveRule) {
        const maxDays = maxConsecutiveRule.config.max_days || 5;
        return consecutiveWorkDays < maxDays;
      }
      return true;
    });

    // Если после фильтрации никого не осталось, берем всех доступных
    const finalEmployees = filteredEmployees.length > 0 ? filteredEmployees : availableEmployees;

    const daySchedule = await generateDaySchedule(
      day,
      month,
      year,
      finalEmployees,
      workingShifts,
      validationRules,
      schedule,
      employees,
      shifts,
      approvedDayOffs
    );

    schedule.push(...daySchedule);
    fillWeekendDayOffs(schedule, day, month, year, employees);
  }

  return schedule;
}

// Получаем количество рабочих дней подряд для сотрудника до указанной даты
function getConsecutiveWorkDays(
  employeeId: string,
  currentDay: number,
  currentMonth: number,
  currentYear: number,
  schedule: ScheduleEntry[]
): number {
  let consecutiveDays = 0;
  let checkDay = currentDay - 1;

  // Проверяем дни в обратном порядке от текущего дня
  while (checkDay > 0) {
    // Ищем запись на этот день для сотрудника
    const dayEntry = schedule.find(s =>
      s.employee_id === employeeId &&
      s.day === checkDay &&
      s.month === currentMonth &&
      s.year === currentYear
    );

    if (!dayEntry) {
      // Если нет записи на этот день, считаем что прерывание
      break;
    }

    if (dayEntry.shift_id === 'day-off') {
      // Если выходной, то последовательность рабочих дней прервана
      break;
    }

    // Если рабочий день, увеличиваем счетчик
    consecutiveDays++;
    checkDay--;
  }

  return consecutiveDays;
}

// Генерируем расписание для одного дня
async function generateDaySchedule(
  day: number,
  month: number,
  year: number,
  employees: Employee[],
  shifts: Shift[],
  validationRules: ValidationRule[],
  existingSchedule: ScheduleEntry[],
  allEmployees: Employee[],
  allShifts: Shift[],
  approvedDayOffs: DayOffRequest[]
): Promise<ScheduleEntry[]> {
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
  const variants = generateScheduleVariants(availableEmployees, shifts, day, month, year, existingSchedule, validationRules);

  if (variants.length === 0) {
    return daySchedule;
  }

  // Оцениваем каждый вариант по правилам валидации
  const scoredVariants = await Promise.all(
    variants.map(async (variant, index) => {
      const scoreResult = await calculateVariantScore(
        variant,
        validationRules,
        existingSchedule,
        allEmployees,
        allShifts,
        month,
        year,
        approvedDayOffs
      );

      return {
        variant,
        score: scoreResult.score,
        ruleResults: scoreResult.ruleResults
      };
    })
  );

  // Сортируем по количеству подряд выполненных правил (больше = лучше)
  // Это соответствует требованию: вариант выполняющий 3 правила подряд лучше чем вариант выполняющий 2 или пропускающий правила
  scoredVariants.sort((a, b) => {
    // Сначала по количеству подряд выполненных правил (больше = лучше)
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Если счеты равны, выбираем вариант который выполняет больше всего правил всего
    const aTotalPassed = a.ruleResults.filter(r => r).length;
    const bTotalPassed = b.ruleResults.filter(r => r).length;
    if (bTotalPassed !== aTotalPassed) {
      return bTotalPassed - aTotalPassed;
    }
    // Если и это равно, предпочитаем паттерн-вариант (индекс 0)
    return a.variant === variants[0] ? -1 : 1;
  });

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
  year: number,
  existingSchedule: ScheduleEntry[],
  validationRules: ValidationRule[]
): ScheduleEntry[][] {
  const variants: ScheduleEntry[][] = [];

  if (employees.length === 0 || shifts.length === 0) {
    return variants;
  }

  const allShifts = [...shifts];
  // Добавляем выходной смену как вариант для генерации
  allShifts.push({ id: 'day-off', name: 'Выходной', abbreviation: 'В', color: '#ef4444', hours: 0, isDefault: false });

  // Вариант 0: Правила-основанный вариант (самый важный)
  // Генерирует график с учетом всех правил валидации
  const patternBasedVariant = generatePatternBasedVariant(employees, shifts, day, month, year, existingSchedule, validationRules);
  if (patternBasedVariant.length > 0) {
    variants.push(patternBasedVariant);
  }

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

// Генерирует варианты на основе всех правил валидации
function generatePatternBasedVariant(
  employees: Employee[],
  shifts: Shift[],
  day: number,
  month: number,
  year: number,
  existingSchedule: ScheduleEntry[],
  validationRules: ValidationRule[]
): ScheduleEntry[] {
  const variant: ScheduleEntry[] = [];

  if (employees.length === 0) return variant;

  // Получаем ограничения из правил
  const maxConsecutiveRule = validationRules.find(r =>
    r.ruleType === 'max_consecutive_work_days' || r.ruleType === 'max_consecutive_shifts'
  );
  const maxConsecutiveWorkDays = maxConsecutiveRule ? maxConsecutiveRule.config.max_days || 5 : 5;

  const minEmployeesRule = validationRules.find(r => r.ruleType === 'min_employees_per_shift');
  const maxEmployeesRule = validationRules.find(r => r.ruleType === 'max_employees_per_shift');
  const requiredWorkDaysRule = validationRules.find(r => r.ruleType === 'required_work_days');
  const coverageRule = validationRules.find(r => r.ruleType === 'coverage_by_day');

  const dayOfWeek = new Date(year, month, day).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Проверяем, является ли день обязательным рабочим днем
  const isRequiredWorkDay = requiredWorkDaysRule &&
    requiredWorkDaysRule.config.days_of_week?.includes(dayOfWeek);

  // Проверяем требования покрытия для этого дня
  const minEmployeesForDay = getMinEmployeesForDay(coverageRule, year, month, day, isWeekend);

  // Создаем массив сотрудников с их приоритетами для работы в этот день
  const employeePriorities = employees.map(employee => {
    const consecutiveWorkDays = getConsecutiveWorkDays(employee.id, day, month, year, existingSchedule);
    const needsDayOff = consecutiveWorkDays >= maxConsecutiveWorkDays;

    let priority = 0;
    // Высокий приоритет для тех, кто может работать (не превышает лимит)
    if (!needsDayOff) {
      priority += 10;
    }
    // Еще выше приоритет для обязательных рабочих дней
    if (isRequiredWorkDay && !needsDayOff) {
      priority += 5;
    }

    return {
      employee,
      priority,
      needsDayOff,
      consecutiveWorkDays
    };
  });

  // Сортируем по приоритету (самые высокие первыми)
  employeePriorities.sort((a, b) => b.priority - a.priority);

  // Определяем минимальное количество работающих сотрудников
  const minWorkingEmployees = Math.max(
    minEmployeesForDay,
    minEmployeesRule ? minEmployeesRule.config.min_employees || 1 : 1,
    Math.floor(employees.length * 0.3) // Минимум 30% должны работать
  );

  // Определяем максимальное количество работающих сотрудников
  const maxWorkingEmployees = maxEmployeesRule ?
    Math.min(maxEmployeesRule.config.max_employees || employees.length, employees.length) :
    employees.length;

  const workingEmployees = Math.min(
    Math.max(employeePriorities.filter(ep => !ep.needsDayOff).length, minWorkingEmployees),
    maxWorkingEmployees
  );

  // Назначаем смены
  for (let i = 0; i < employeePriorities.length; i++) {
    const { employee, needsDayOff } = employeePriorities[i];

    if (i < workingEmployees && !needsDayOff && shifts.length > 0) {
      // Назначаем рабочую смену
      const shiftIndex = i % shifts.length;
      variant.push({
        employee_id: employee.id,
        day,
        month,
        year,
        shift_id: shifts[shiftIndex].id
      });
    } else {
      // Назначаем выходной
      variant.push({
        employee_id: employee.id,
        day,
        month,
        year,
        shift_id: 'day-off'
      });
    }
  }

  // Дополнительная корректировка по правилам количества сотрудников
  if (minEmployeesRule || maxEmployeesRule) {
    return adjustVariantForEmployeeLimits(variant, employees, shifts, minEmployeesRule, maxEmployeesRule);
  }

  return variant;
}

// Получает минимальное количество сотрудников для дня из правил покрытия
function getMinEmployeesForDay(
  coverageRule: ValidationRule | undefined,
  year: number,
  month: number,
  day: number,
  isWeekend: boolean
): number {
  if (!coverageRule) return 1;

  const dayType = coverageRule.config.day_type;
  const minEmployees = coverageRule.config.min_employees || 1;

  // Если правило применяется только к будням или выходным
  if (dayType === 'weekdays' && isWeekend) return 0;
  if (dayType === 'weekends' && !isWeekend) return 0;

  return minEmployees;
}

// Корректирует вариант по правилам количества сотрудников
function adjustVariantForEmployeeLimits(
  variant: ScheduleEntry[],
  employees: Employee[],
  shifts: Shift[],
  minEmployeesRule: ValidationRule | undefined,
  maxEmployeesRule: ValidationRule | undefined
): ScheduleEntry[] {
  // Если нет ограничений, возвращаем как есть
  if (!minEmployeesRule && !maxEmployeesRule) {
    return variant;
  }

  // Считаем сотрудников по сменам
  const shiftCounts = new Map<string, number>();
  for (const entry of variant) {
    if (entry.shift_id !== 'day-off') {
      shiftCounts.set(entry.shift_id, (shiftCounts.get(entry.shift_id) || 0) + 1);
    }
  }

  // Корректируем при нарушении ограничений
  const adjustedVariant = [...variant];

  // Проверяем минимальное количество сотрудников
  if (minEmployeesRule) {
    const minEmployees = minEmployeesRule.config.min_employees || 1;
    const shiftIds = minEmployeesRule.config.shift_ids || [];

    for (const shiftId of shiftIds) {
      const currentCount = shiftCounts.get(shiftId) || 0;
      const needed = minEmployees - currentCount;

      if (needed > 0) {
        // Добавляем сотрудников до минимума
        const availableEmployees = adjustedVariant
          .filter(e => e.shift_id === 'day-off')
          .slice(0, needed);

        availableEmployees.forEach(entry => {
          entry.shift_id = shiftId;
        });
      }
    }
  }

  // Проверяем максимальное количество сотрудников
  if (maxEmployeesRule) {
    const maxEmployees = maxEmployeesRule.config.max_employees || employees.length;
    const shiftIds = maxEmployeesRule.config.shift_ids || [];

    for (const shiftId of shiftIds) {
      const currentCount = shiftCounts.get(shiftId) || 0;
      const excess = currentCount - maxEmployees;

      if (excess > 0) {
        // Убираем лишних сотрудников в выходной
        const excessEntries = adjustedVariant
          .filter(e => e.shift_id === shiftId)
          .slice(0, excess);

        excessEntries.forEach(entry => {
          entry.shift_id = 'day-off';
        });
      }
    }
  }

  return adjustedVariant;
}

// Рассчитываем оценку варианта по правилам валидации
async function calculateVariantScore(
  variant: ScheduleEntry[],
  validationRules: ValidationRule[],
  existingSchedule: ScheduleEntry[],
  employees: Employee[],
  shifts: Shift[],
  month: number,
  year: number,
  approvedDayOffs: DayOffRequest[]
): Promise<{ score: number; ruleResults: boolean[] }> {
  const tempSchedule = [...existingSchedule, ...variant];
  const context = buildValidationContext(tempSchedule, employees, shifts, month, year, approvedDayOffs);

  const ruleResults: boolean[] = [];

  for (const rule of validationRules) {
    const violations = await evaluateValidationRule(rule, context);
    ruleResults.push(violations.length === 0);
  }

  let consecutivePasses = 0;
  for (const passed of ruleResults) {
    if (passed) {
      consecutivePasses++;
    } else {
      break;
    }
  }

  return {
    score: consecutivePasses,
    ruleResults
  };
}

function buildValidationContext(
  schedule: ScheduleEntry[],
  employees: Employee[],
  shifts: Shift[],
  month: number,
  year: number,
  approvedDayOffs: DayOffRequest[]
): ValidationContext {
  return {
    schedule: mapScheduleEntriesForValidation(schedule),
    employees,
    shifts,
    month,
    year,
    approvedDayOffs
  };
}

function mapScheduleEntriesForValidation(entries: ScheduleEntry[]): ModelScheduleEntry[] {
  return entries.map((entry, index) => ({
    id: entry.id ?? index + 1,
    employeeId: entry.employee_id,
    day: entry.day,
    month: entry.month,
    year: entry.year,
    shiftId: entry.shift_id
  }));
}

function fillWeekendDayOffs(
  schedule: ScheduleEntry[],
  day: number,
  month: number,
  year: number,
  employees: Employee[]
) {
  if (!isWeekendDay(year, month, day)) {
    return;
  }

  // Автоматически заполняем выходные дни для всех сотрудников в выходные (суббота и воскресенье)
  // согласно требованию 1.5 - выходные дни автоматически заполняются выходными
  for (const employee of employees) {
    const hasEntry = schedule.some(entry =>
      entry.employee_id === employee.id &&
      entry.day === day &&
      entry.month === month &&
      entry.year === year
    );

    // Если у сотрудника еще нет записи на этот день, добавляем выходной
    if (!hasEntry) {
      schedule.push({
        employee_id: employee.id,
        day,
        month,
        year,
        shift_id: 'day-off'
      });
    }
  }
}

function isWeekendDay(year: number, month: number, day: number): boolean {
  const dayOfWeek = new Date(year, month, day).getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = воскресенье, 6 = суббота
}

// Проверяем выполнение правила (возвращает boolean)
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
