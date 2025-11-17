/**
 * Типы данных для RaboTA Backend
 * Соответствуют структуре frontend
 */

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
  created_at?: Date;
  updated_at?: Date;
}

export interface RoleInput {
  name: string;
  permissions?: RolePermissions;
  color?: string;
  description?: string;
}

// Сотрудник с ролью
export interface Employee {
  id: string;
  name: string;
  roleId?: number;                  // Ссылка на роль
  role?: Role;                      // Объект роли (при JOIN запросах)
  excludeFromHours?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmployeeInput {
  id: string;
  name: string;
  roleId?: number;
  excludeFromHours?: boolean;
}

// LEGACY: старые типы для обратной совместимости (будут удалены позже)
export type EmployeeRole = 'manager' | 'deputy_manager' | 'storekeeper' | 'employee';

export interface Shift {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  hours: number;
  startTime?: string; // HH:MM формат
  endTime?: string;   // HH:MM формат
  isDefault?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface ShiftInput {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  hours: number;
  startTime?: string;
  endTime?: string;
  isDefault?: boolean;
}

export interface ScheduleEntry {
  id: number;
  employeeId: string;
  day: number;
  month: number;
  year: number;
  shiftId: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface ScheduleEntryInput {
  employeeId: string;
  day: number;
  month: number;
  year: number;
  shiftId: string;
}

// Настройки приложения
export interface AppSetting {
  id: number;
  key: string;
  value: string; // JSON string
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface AppSettingInput {
  key: string;
  value: string;
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
  | 'max_hours_without_managers'
  | 'employee_hours_limit'
  | 'recommended_work_days'
  | 'required_work_days'
  | 'coverage_by_time'
  | 'coverage_by_day'
  | 'shift_type_limit_per_day'
  | 'max_consecutive_work_days'
  | 'max_consecutive_days_off'
  | 'employee_day_off';

export type EnforcementType = 'warning' | 'error' | 'info';

export interface ValidationRule {
  id: number;
  ruleType: ValidationRuleType;
  enabled: boolean;
  config: Record<string, any>; // JSON object
  appliesToRoles?: EmployeeRole[];
  appliesToEmployees?: string[]; // Array of employee IDs
  enforcementType?: EnforcementType;
  customMessage?: string;
  priority: number;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface ValidationRuleInput {
  ruleType: ValidationRuleType;
  enabled: boolean;
  config: Record<string, any>;
  appliesToRoles?: EmployeeRole[];
  appliesToEmployees?: string[];
  enforcementType?: EnforcementType;
  customMessage?: string;
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
  created_at?: Date;
  updated_at?: Date;
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
  targetDate?: string; // ISO date string
  targetShiftId?: string;
  reasonId?: number;
  priority: number;
  status: PreferenceStatus;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
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
