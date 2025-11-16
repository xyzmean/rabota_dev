// Права доступа для ролей
export interface RolePermissions {
  manage_schedule?: boolean;        // Управление графиком
  manage_employees?: boolean;       // Управление сотрудниками
  manage_shifts?: boolean;          // Управление сменами
  manage_settings?: boolean;        // Управление настройками
  view_statistics?: boolean;        // Просмотр статистики
  approve_preferences?: boolean;    // Одобрение запросов сотрудников
  manage_roles?: boolean;           // Управление ролями
  manage_validation_rules?: boolean; // Управление правилами валидации
}

// Роль с настраиваемыми правами
export interface Role {
  id: number;
  name: string;
  permissions: RolePermissions;
  color?: string;
  description?: string;
  isSystem?: boolean;  // Системная роль (нельзя удалить)
}

export interface RoleInput {
  name: string;
  permissions?: RolePermissions;
  color?: string;
  description?: string;
}

// LEGACY: старые типы для обратной совместимости
export type EmployeeRole = 'manager' | 'deputy_manager' | 'storekeeper' | 'employee';

export interface Shift {
  id: string;
  name: string;
  abbreviation: string; // 2-letter code like "в", "п", "2У", "Ic", "о"
  color: string; // hex color for visual distinction
  hours: number; // hours per shift (0 for weekend)
  startTime?: string; // HH:MM формат
  endTime?: string;   // HH:MM формат
  isDefault?: boolean; // if true, this shift cannot be edited or deleted
}

export interface Employee {
  id: string;
  name: string;
  roleId?: number;                  // Ссылка на роль
  role?: Role;                      // Объект роли (при JOIN запросах)
  excludeFromHours?: boolean; // if true, this employee's hours won't be counted (УМ/ЗУМ)
}

export interface ScheduleEntry {
  employeeId: string;
  day: number; // day of month (1-31)
  month: number; // 0-11 (JavaScript month format)
  year: number;
  shiftId: string;
}

export interface MonthData {
  month: number;
  year: number;
  daysInMonth: number;
}

// Настройки приложения
export interface AppSetting {
  id: number;
  key: string;
  value: string; // JSON string
  description?: string;
}

// Правила валидации
export type ValidationRuleType =
  | 'max_consecutive_shifts'
  | 'min_employees_per_shift'
  | 'max_employees_per_shift'
  | 'max_employees_per_shift_type'
  | 'required_coverage'
  | 'manager_requirements'
  | 'max_total_hours'
  | 'max_hours_without_managers';

export interface ValidationRule {
  id: number;
  ruleType: ValidationRuleType;
  enabled: boolean;
  config: Record<string, any>; // JSON object
  appliesToRoles?: EmployeeRole[];
  priority: number;
  description?: string;
}

export interface ValidationRuleInput {
  ruleType: ValidationRuleType;
  enabled: boolean;
  config: Record<string, any>;
  appliesToRoles?: EmployeeRole[];
  priority?: number;
  description?: string;
}

// Причины для запросов сотрудников
export interface PreferenceReason {
  id: number;
  name: string;
  priority: number;
  color?: string;
  description?: string;
}

export interface PreferenceReasonInput {
  name: string;
  priority?: number;
  color?: string;
  description?: string;
}

// Пожелания сотрудников
export type PreferenceType = 'day_off' | 'preferred_shift' | 'avoid_shift';
export type PreferenceStatus = 'pending' | 'approved' | 'rejected';

export interface EmployeePreference {
  id: number;
  employeeId: string;
  preferenceType: PreferenceType;
  targetDate?: string; // ISO date string (YYYY-MM-DD)
  targetShiftId?: string;
  reasonId?: number;
  priority: number;
  status: PreferenceStatus;
  notes?: string;
}

export interface EmployeePreferenceInput {
  employeeId: string;
  preferenceType: PreferenceType;
  targetDate?: string;
  targetShiftId?: string;
  reasonId?: number;
  priority?: number;
  status?: PreferenceStatus;
  notes?: string;
}

// Результаты валидации
export interface ValidationViolation {
  type: ValidationRuleType;
  severity: 'error' | 'warning';
  message: string;
  employeeId?: string;
  date?: string; // YYYY-MM-DD
  metadata?: Record<string, any>;
}

export interface ScheduleValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
}
