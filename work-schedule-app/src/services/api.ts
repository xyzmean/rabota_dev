import {
  Employee,
  Shift,
  ScheduleEntry,
  AppSetting,
  EmployeePreference,
  EmployeePreferenceInput,
  PreferenceReason,
  PreferenceReasonInput,
  Role,
  RoleInput,
} from '../types';

// AutoSched types
export interface AutoScheduleGenerationOptions {
  month: number;
  year: number;
  options?: {
    algorithm?: 'greedy' | 'constraint' | 'hybrid';
    optimizationFocus?: 'coverage' | 'balance' | 'preferences';
    maxIterations?: number;
    timeoutMs?: number;
  };
}

export interface AutoScheduleResult {
  success: boolean;
  generationId: number;
  month: number;
  year: number;
  schedule: ScheduleEntry[];
  violations: RuleViolation[];
  metrics: ScheduleMetrics;
  generationTime: number;
  message: string;
}

export interface RuleViolation {
  ruleType: string;
  severity: 'error' | 'warning';
  employeeId?: string;
  day?: number;
  shiftId?: string;
  message: string;
  priority: number;
}

export interface ScheduleMetrics {
  totalShifts: number;
  coveragePercentage: number;
  balanceScore: number;
  preferenceSatisfactionRate: number;
  violationCount: number;
  errorCount: number;
  warningCount: number;
}

export interface ScheduleGeneration {
  id: number;
  month: number;
  year: number;
  status: string;
  total_violations: number;
  generation_time_ms: number;
  created_at: string;
  generated_by_name?: string;
}

export interface OptimizationSuggestion {
  type: string;
  before: any;
  after: any;
  score: number;
  description: string;
}

// API URL - всегда используем относительный путь
// В development Vite проксирует /api на http://localhost:3001 (см. vite.config.ts)
// В production Nginx проксирует /api на backend контейнер
const API_URL = import.meta.env.VITE_API_URL || '/api';

// Обработка ошибок API
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || `HTTP ${response.status}`);
  }

  // Для 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
};

// === Employee API ===

export const employeeApi = {
  getAll: async (): Promise<Employee[]> => {
    const response = await fetch(`${API_URL}/employees`);
    return handleResponse<Employee[]>(response);
  },

  getById: async (id: string): Promise<Employee> => {
    const response = await fetch(`${API_URL}/employees/${id}`);
    return handleResponse<Employee>(response);
  },

  create: async (employee: Omit<Employee, 'created_at' | 'updated_at'>): Promise<Employee> => {
    const response = await fetch(`${API_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employee),
    });
    return handleResponse<Employee>(response);
  },

  update: async (id: string, employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>): Promise<Employee> => {
    const response = await fetch(`${API_URL}/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(employee),
    });
    return handleResponse<Employee>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/employees/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// === Shift API ===

export const shiftApi = {
  getAll: async (): Promise<Shift[]> => {
    const response = await fetch(`${API_URL}/shifts`);
    return handleResponse<Shift[]>(response);
  },

  getById: async (id: string): Promise<Shift> => {
    const response = await fetch(`${API_URL}/shifts/${id}`);
    return handleResponse<Shift>(response);
  },

  create: async (shift: Omit<Shift, 'created_at' | 'updated_at'>): Promise<Shift> => {
    const response = await fetch(`${API_URL}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shift),
    });
    return handleResponse<Shift>(response);
  },

  update: async (id: string, shift: Omit<Shift, 'id' | 'created_at' | 'updated_at'>): Promise<Shift> => {
    const response = await fetch(`${API_URL}/shifts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shift),
    });
    return handleResponse<Shift>(response);
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/shifts/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// Алиас для обратной совместимости
export const shiftsApi = shiftApi;

// === Schedule API ===

export const scheduleApi = {
  getAll: async (month?: number, year?: number): Promise<ScheduleEntry[]> => {
    let url = `${API_URL}/schedule`;
    if (month !== undefined && year !== undefined) {
      url += `?month=${month}&year=${year}`;
    }
    const response = await fetch(url);
    return handleResponse<ScheduleEntry[]>(response);
  },

  getById: async (id: number): Promise<ScheduleEntry> => {
    const response = await fetch(`${API_URL}/schedule/${id}`);
    return handleResponse<ScheduleEntry>(response);
  },

  create: async (entry: Omit<ScheduleEntry, 'id' | 'created_at' | 'updated_at'>): Promise<ScheduleEntry> => {
    const response = await fetch(`${API_URL}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return handleResponse<ScheduleEntry>(response);
  },

  update: async (id: number, entry: Omit<ScheduleEntry, 'id' | 'created_at' | 'updated_at'>): Promise<ScheduleEntry> => {
    const response = await fetch(`${API_URL}/schedule/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return handleResponse<ScheduleEntry>(response);
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/schedule/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },

  deleteByDateAndEmployee: async (employeeId: string, day: number, month: number, year: number): Promise<void> => {
    const response = await fetch(`${API_URL}/schedule/delete-by-date`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, day, month, year }),
    });
    return handleResponse<void>(response);
  },

  bulkUpsert: async (entries: Omit<ScheduleEntry, 'id' | 'created_at' | 'updated_at'>[]): Promise<ScheduleEntry[]> => {
    const response = await fetch(`${API_URL}/schedule/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
    return handleResponse<ScheduleEntry[]>(response);
  },

  };

// === Settings API ===

export const settingsApi = {
  getAll: async (): Promise<AppSetting[]> => {
    const response = await fetch(`${API_URL}/settings`);
    return handleResponse<AppSetting[]>(response);
  },

  getByKey: async (key: string): Promise<AppSetting> => {
    const response = await fetch(`${API_URL}/settings/${key}`);
    return handleResponse<AppSetting>(response);
  },

  getBulk: async (keys: string[]): Promise<AppSetting[]> => {
    const response = await fetch(`${API_URL}/settings/bulk?keys=${keys.join(',')}`);
    return handleResponse<AppSetting[]>(response);
  },

  create: async (setting: { key: string; value: string; description?: string }): Promise<AppSetting> => {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setting),
    });
    return handleResponse<AppSetting>(response);
  },

  update: async (key: string, value: string, description?: string): Promise<AppSetting> => {
    const response = await fetch(`${API_URL}/settings/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, description }),
    });
    return handleResponse<AppSetting>(response);
  },

  delete: async (key: string): Promise<void> => {
    const response = await fetch(`${API_URL}/settings/${key}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};


// === Employee Preferences API ===

export const preferencesApi = {
  getAll: async (filters?: {
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<EmployeePreference[]> => {
    let url = `${API_URL}/preferences`;
    const params = new URLSearchParams();

    if (filters) {
      if (filters.employeeId) params.append('employeeId', filters.employeeId);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
    }

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const response = await fetch(url);
    return handleResponse<EmployeePreference[]>(response);
  },

  getById: async (id: number): Promise<EmployeePreference> => {
    const response = await fetch(`${API_URL}/preferences/${id}`);
    return handleResponse<EmployeePreference>(response);
  },

  getByEmployee: async (employeeId: string): Promise<EmployeePreference[]> => {
    const response = await fetch(`${API_URL}/preferences/employee/${employeeId}`);
    return handleResponse<EmployeePreference[]>(response);
  },

  create: async (preference: EmployeePreferenceInput): Promise<EmployeePreference> => {
    const response = await fetch(`${API_URL}/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preference),
    });
    return handleResponse<EmployeePreference>(response);
  },

  update: async (id: number, preference: Partial<EmployeePreferenceInput>): Promise<EmployeePreference> => {
    const response = await fetch(`${API_URL}/preferences/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preference),
    });
    return handleResponse<EmployeePreference>(response);
  },

  updateStatus: async (id: number, status: 'pending' | 'approved' | 'rejected'): Promise<EmployeePreference> => {
    const response = await fetch(`${API_URL}/preferences/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return handleResponse<EmployeePreference>(response);
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/preferences/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};

// === Preference Reasons API ===

export const preferenceReasonsApi = {
  getAll: async (): Promise<PreferenceReason[]> => {
    const response = await fetch(`${API_URL}/preference-reasons`);
    return handleResponse<PreferenceReason[]>(response);
  },

  getById: async (id: number): Promise<PreferenceReason> => {
    const response = await fetch(`${API_URL}/preference-reasons/${id}`);
    return handleResponse<PreferenceReason>(response);
  },

  create: async (reason: PreferenceReasonInput): Promise<PreferenceReason> => {
    const response = await fetch(`${API_URL}/preference-reasons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason),
    });
    return handleResponse<PreferenceReason>(response);
  },

  update: async (id: number, reason: Partial<PreferenceReasonInput>): Promise<PreferenceReason> => {
    const response = await fetch(`${API_URL}/preference-reasons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reason),
    });
    return handleResponse<PreferenceReason>(response);
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/preference-reasons/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },

  reorder: async (orderedIds: number[]): Promise<PreferenceReason[]> => {
    const response = await fetch(`${API_URL}/preference-reasons/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    });
    return handleResponse<PreferenceReason[]>(response);
  },
};

// === Roles API ===

export const roleApi = {
  getAll: async (): Promise<Role[]> => {
    const response = await fetch(`${API_URL}/roles`);
    return handleResponse<Role[]>(response);
  },

  getById: async (id: number): Promise<Role> => {
    const response = await fetch(`${API_URL}/roles/${id}`);
    return handleResponse<Role>(response);
  },

  create: async (role: RoleInput): Promise<Role> => {
    const response = await fetch(`${API_URL}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    return handleResponse<Role>(response);
  },

  update: async (id: number, role: Partial<RoleInput>): Promise<Role> => {
    const response = await fetch(`${API_URL}/roles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(role),
    });
    return handleResponse<Role>(response);
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/roles/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(response);
  },
};


// === Database API ===

export const databaseApi = {
  getStats: async (): Promise<{ success: boolean; stats: any; totalRecords: number }> => {
    const response = await fetch(`${API_URL}/database/stats`);
    return handleResponse<{ success: boolean; stats: any; totalRecords: number }>(response);
  },

  clearDatabase: async (): Promise<{ success: boolean; message: string; clearedTables: string[] }> => {
    const response = await fetch(`${API_URL}/database/clear`, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string; clearedTables: string[] }>(response);
  },

  clearSchedule: async (month?: number, year?: number): Promise<{ success: boolean; message: string; deletedRecords: number }> => {
    let url = `${API_URL}/database/schedule`;
    const params = new URLSearchParams();

    if (month !== undefined && year !== undefined) {
      params.append('month', month.toString());
      params.append('year', year.toString());
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      method: 'DELETE',
    });
    return handleResponse<{ success: boolean; message: string; deletedRecords: number }>(response);
  },
};

// === AutoSchedule API ===

export const autoScheduleApi = {
  // Generate schedule for a specific month/year
  generateSchedule: async (options: AutoScheduleGenerationOptions): Promise<AutoScheduleResult> => {
    const response = await fetch(`${API_URL}/auto-schedule/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });
    return handleResponse<AutoScheduleResult>(response);
  },

  // Get generation history and status
  getGenerationHistory: async (limit: number = 12): Promise<{ success: boolean; generations: ScheduleGeneration[] }> => {
    const response = await fetch(`${API_URL}/auto-schedule/history?limit=${limit}`);
    return handleResponse<{ success: boolean; generations: ScheduleGeneration[] }>(response);
  },

  // Validate current schedule against all rules
  validateSchedule: async (month: number, year: number): Promise<{
    success: boolean;
    isValid: boolean;
    violations: RuleViolation[];
    warnings: RuleViolation[];
    metrics: ScheduleMetrics;
  }> => {
    const response = await fetch(`${API_URL}/auto-schedule/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ month, year }),
    });
    return handleResponse<{
      success: boolean;
      isValid: boolean;
      violations: RuleViolation[];
      warnings: RuleViolation[];
      metrics: ScheduleMetrics;
    }>(response);
  },

  // Get suggested improvements for current schedule
  suggestImprovements: async (month: number, year: number, focusAreas: string[] = []): Promise<{
    success: boolean;
    suggestions: OptimizationSuggestion[];
    potentialImprovements: number;
  }> => {
    const response = await fetch(`${API_URL}/auto-schedule/suggest-improvements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ month, year, focus_areas: focusAreas }),
    });
    return handleResponse<{
      success: boolean;
      suggestions: OptimizationSuggestion[];
      potentialImprovements: number;
    }>(response);
  },

  // Apply specific optimization to schedule
  optimizeSchedule: async (month: number, year: number, optimizationType: string, constraints: any = {}): Promise<{
    success: boolean;
    optimizationType: string;
    improvements: any;
    newViolations: RuleViolation[];
    metrics: ScheduleMetrics;
  }> => {
    const response = await fetch(`${API_URL}/auto-schedule/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ month, year, optimization_type: optimizationType, constraints }),
    });
    return handleResponse<{
      success: boolean;
      optimizationType: string;
      improvements: any;
      newViolations: RuleViolation[];
      metrics: ScheduleMetrics;
    }>(response);
  },

  // Get employee workload statistics
  getWorkloadStats: async (month: number, year: number, employeeId?: string): Promise<{
    success: boolean;
    month: number;
    year: number;
    stats: Array<{
      employee_id: string;
      employee_name: string;
      role_name?: string;
      role_color?: string;
      total_shifts: number;
      total_hours: number;
      consecutive_days_max: number;
      night_shifts_count: number;
      weekend_shifts_count: number;
      preference_satisfaction_rate: number;
      workload_score: number;
    }>;
  }> => {
    let url = `${API_URL}/auto-schedule/workload-stats?month=${month}&year=${year}`;
    if (employeeId) {
      url += `&employee_id=${employeeId}`;
    }
    const response = await fetch(url);
    return handleResponse<{
      success: boolean;
      month: number;
      year: number;
      stats: Array<{
        employee_id: string;
        employee_name: string;
        role_name?: string;
        role_color?: string;
        total_shifts: number;
        total_hours: number;
        consecutive_days_max: number;
        night_shifts_count: number;
        weekend_shifts_count: number;
        preference_satisfaction_rate: number;
        workload_score: number;
      }>;
    }>(response);
  },

  // Get available schedule templates
  getScheduleTemplates: async (): Promise<{ success: boolean; templates: Array<any> }> => {
    const response = await fetch(`${API_URL}/auto-schedule/templates`);
    return handleResponse<{ success: boolean; templates: Array<any> }>(response);
  },

  // Create new schedule template
  createScheduleTemplate: async (name: string, description: string, patternData: any): Promise<{ success: boolean; template: any }> => {
    const response = await fetch(`${API_URL}/auto-schedule/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description, pattern_data: patternData }),
    });
    return handleResponse<{ success: boolean; template: any }>(response);
  },
};

// Health check
export const healthCheck = async (): Promise<{ status: string }> => {
  const response = await fetch(`${API_URL.replace('/api', '')}/health`);
  return handleResponse<{ status: string }>(response);
};
