import { Request, Response } from 'express';
import pool from '../config/database';
import { Employee, Shift, ValidationRule } from '../models/types';

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

// Генерируем оптимальный график по принципу ScheduleGenerator
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

  // Получаем базовые правила для генерации
  const minEmployeesRule = validationRules.find(r => r.ruleType === 'min_employees_per_shift');
  const maxConsecutiveRule = validationRules.find(r =>
    r.ruleType === 'max_consecutive_work_days' || r.ruleType === 'max_consecutive_shifts'
  );
  const maxConsecutiveDays = maxConsecutiveRule ? maxConsecutiveRule.config.max_days || 5 : 5;
  const minEmployeesPerShift = minEmployeesRule ? minEmployeesRule.config.min_employees || 1 : 1;

  // Назначаем выходные по запросам
  for (const employee of employees) {
    for (const dayOff of approvedDayOffs) {
      if (dayOff.employeeId === employee.id) {
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
        if (offYear === year && offMonth === month + 1) {
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

  // Создаем массив трекинга рабочих дней для каждого сотрудника
  const workDaysTracker = new Map<string, number>();
  employees.forEach(emp => workDaysTracker.set(emp.id, 0));

  // Для каждого дня месяца генерируем расписание
  for (let day = 1; day <= daysInMonth; day++) {
    const daySchedule = generateDayScheduleSimple(
      day,
      month,
      year,
      employees,
      workingShifts,
      schedule,
      workDaysTracker,
      minEmployeesPerShift,
      maxConsecutiveDays
    );

    schedule.push(...daySchedule);
  }

  return schedule;
}

// Простая генерация расписания на день по принципу ScheduleGenerator
function generateDayScheduleSimple(
  day: number,
  month: number,
  year: number,
  employees: Employee[],
  shifts: Shift[],
  existingSchedule: ScheduleEntry[],
  workDaysTracker: Map<string, number>,
  minEmployeesPerShift: number,
  maxConsecutiveDays: number
): ScheduleEntry[] {
  const daySchedule: ScheduleEntry[] = [];

  // Получаем сотрудников, у которых уже есть расписание на этот день
  const alreadyScheduled = existingSchedule
    .filter(s => s.day === day && s.month === month && s.year === year)
    .map(s => s.employee_id);

  // Доступные сотрудники для этого дня
  const availableEmployees = employees.filter(emp => !alreadyScheduled.includes(emp.id));

  if (availableEmployees.length === 0 || shifts.length === 0) {
    return daySchedule;
  }

  // Обновляем счетчики рабочих дней подряд
  for (const emp of availableEmployees) {
    const consecutiveDays = getConsecutiveWorkDays(emp.id, day, month, year, existingSchedule);
    workDaysTracker.set(emp.id, consecutiveDays);
  }

  // Сортируем сотрудников по приоритету:
  // 1. Меньше всего рабочих дней подряд
  // 2. Равномерное распределение смен
  const employeePriorities = availableEmployees.map(emp => {
    const consecutiveDays = workDaysTracker.get(emp.id) || 0;
    const needsDayOff = consecutiveDays >= maxConsecutiveDays;

    // Считаем количество смен этого сотрудника в текущем месяце
    const monthlyShifts = existingSchedule.filter(s =>
      s.employee_id === emp.id &&
      s.month === month &&
      s.year === year &&
      s.shift_id !== 'day-off'
    ).length;

    return {
      employee: emp,
      priority: needsDayOff ? -1 : 1000 - consecutiveDays - monthlyShifts * 10, // чем меньше приоритет, тем лучше
      needsDayOff,
      consecutiveDays
    };
  });

  // Сортируем по приоритету (сначала те, кому нужен выходной, потом по убыванию приоритета)
  employeePriorities.sort((a, b) => {
    if (a.needsDayOff && !b.needsDayOff) return 1; // a в конец
    if (!a.needsDayOff && b.needsDayOff) return -1; // b в конец
    return b.priority - a.priority; // по убыванию приоритета
  });

  // Распределяем смены поочередно для равномерности
  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    let employeesAssigned = 0;

    // Назначаем минимальное количество сотрудников на смену
    for (const empData of employeePriorities) {
      if (employeesAssigned >= minEmployeesPerShift) break;
      if (empData.needsDayOff) continue; // Пропускаем тех, кому нужен выходной

      // Проверяем, не назначен ли уже сотрудник на другую смену сегодня
      const alreadyAssignedToday = daySchedule.some(s => s.employee_id === empData.employee.id);
      if (alreadyAssignedToday) continue;

      daySchedule.push({
        employee_id: empData.employee.id,
        day,
        month,
        year,
        shift_id: shift.id
      });

      employeesAssigned++;
    }

    // Если назначили меньше минимума, пробуем назначить еще с учетом NeedsDayOff
    if (employeesAssigned < minEmployeesPerShift) {
      for (const empData of employeePriorities) {
        if (employeesAssigned >= minEmployeesPerShift) break;

        const alreadyAssignedToday = daySchedule.some(s => s.employee_id === empData.employee.id);
        if (!alreadyAssignedToday) {
          // Заменяем предыдущий выходной на смену
          const existingIndex = daySchedule.findIndex(s => s.employee_id === empData.employee.id && s.shift_id === 'day-off');
          if (existingIndex !== -1) {
            daySchedule[existingIndex].shift_id = shift.id;
            employeesAssigned++;
          } else {
            daySchedule.push({
              employee_id: empData.employee.id,
              day,
              month,
              year,
              shift_id: shift.id
            });
            employeesAssigned++;
          }
        }
      }
    }
  }

  // Оставшимся доступным сотрудникам назначаем выходные
  for (const empData of employeePriorities) {
    const alreadyAssigned = daySchedule.some(s => s.employee_id === empData.employee.id);
    if (!alreadyAssigned) {
      daySchedule.push({
        employee_id: empData.employee.id,
        day,
        month,
        year,
        shift_id: 'day-off'
      });
    }
  }

  return daySchedule;
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

// Очистка базы данных
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