/**
 * Типы данных для RaboTA Backend
 * Соответствуют структуре frontend
 */

export interface Employee {
  id: string;
  name: string;
  excludeFromHours?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface EmployeeInput {
  id: string;
  name: string;
  excludeFromHours?: boolean;
}

export interface Shift {
  id: string;
  name: string;
  abbreviation: string;
  color: string;
  hours: number;
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
