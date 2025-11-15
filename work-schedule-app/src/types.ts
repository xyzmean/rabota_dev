export interface Shift {
  id: string;
  name: string;
  abbreviation: string; // 2-letter code like "в", "п", "2У", "Ic", "о"
  color: string; // hex color for visual distinction
  hours: number; // hours per shift (0 for weekend)
  isDefault?: boolean; // if true, this shift cannot be edited or deleted
}

export interface Employee {
  id: string;
  name: string;
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
