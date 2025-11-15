import { Employee, Shift, ScheduleEntry } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

// Health check
export const healthCheck = async (): Promise<{ status: string }> => {
  const response = await fetch(`${API_URL.replace('/api', '')}/health`);
  return handleResponse<{ status: string }>(response);
};
