/**
 * Типы данных для RaboTA Backend
 * Соответствуют структуре frontend
 */

// Роли сотрудников
export type EmployeeRole = 'manager' | 'deputy_manager' | 'storekeeper' | 'employee';

export interface Employee {
  id: string;
  name: string;
  role?: EmployeeRole;
  excludeFromHours?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmployeeInput {
  id: string;
  name: string;
  role?: EmployeeRole;
  excludeFromHours?: boolean;
}

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
  | 'max_hours_without_managers';

export interface ValidationRule {
  id: number;
  ruleType: ValidationRuleType;
  enabled: boolean;
  config: Record<string, any>; // JSON object
  appliesToRoles?: EmployeeRole[];
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
