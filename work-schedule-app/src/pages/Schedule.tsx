import { useState, useEffect } from 'react';
import { Calendar, Users, Home, Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import EmployeeManager from '../components/EmployeeManager';
import { ScheduleCalendar } from '../components/ScheduleCalendar';
import { shiftsApi } from '../services/api';
import { Employee, Shift, ScheduleEntry } from '../types';

type Tab = 'schedule' | 'employees';

export default function Schedule() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useLocalStorage<Employee[]>('workSchedule_employees', []);
  const [schedule, setSchedule] = useLocalStorage<ScheduleEntry[]>('workSchedule_schedule', []);
  const [loading, setLoading] = useState(true);

  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Load shifts from API
  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    try {
      const shiftsData = await shiftsApi.getAll();
      setShifts(shiftsData);
    } catch (err) {
      console.error('Failed to load shifts:', err);
    } finally {
      setLoading(false);
    }
  };

  // Employee handlers
  const handleAddEmployee = (employeeData: Omit<Employee, 'id'>) => {
    const newEmployee: Employee = { ...employeeData, id: generateId() };
    setEmployees([...employees, newEmployee]);

    // Find the weekend shift (В)
    const weekendShift = shifts.find(s => s.abbreviation === 'В');
    if (weekendShift) {
      // Set all days of current month to weekend shift for new employee
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

      const newScheduleEntries: ScheduleEntry[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        newScheduleEntries.push({
          employeeId: newEmployee.id,
          day,
          month: currentMonth,
          year: currentYear,
          shiftId: weekendShift.id
        });
      }
      setSchedule([...schedule, ...newScheduleEntries]);
    }
  };

  const handleEditEmployee = (id: string, employeeData: Omit<Employee, 'id'>) => {
    setEmployees(employees.map((emp) => (emp.id === id ? { ...employeeData, id } : emp)));
  };

  const handleDeleteEmployee = (id: string) => {
    if (confirm('Удалить этого сотрудника? Все его назначения в графике будут удалены.')) {
      setEmployees(employees.filter((emp) => emp.id !== id));
      setSchedule(schedule.filter((entry) => entry.employeeId !== id));
    }
  };

  // Schedule handlers
  const handleScheduleChange = (newEntry: ScheduleEntry) => {
    const existingIndex = schedule.findIndex(
      (entry) =>
        entry.employeeId === newEntry.employeeId &&
        entry.day === newEntry.day &&
        entry.month === newEntry.month &&
        entry.year === newEntry.year
    );

    if (existingIndex >= 0) {
      const updatedSchedule = [...schedule];
      updatedSchedule[existingIndex] = newEntry;
      setSchedule(updatedSchedule);
    } else {
      setSchedule([...schedule, newEntry]);
    }
  };

  const handleScheduleRemove = (employeeId: string, day: number, month: number, year: number) => {
    setSchedule(
      schedule.filter(
        (entry) =>
          !(entry.employeeId === employeeId && entry.day === day && entry.month === month && entry.year === year)
      )
    );
  };

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'schedule', label: 'График работы', icon: <Calendar size={20} /> },
    { id: 'employees', label: 'Сотрудники', icon: <Users size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Управление графиком работы</h1>
              <p className="text-blue-100 mt-1">Современная система планирования рабочих смен</p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/settings"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                title="Настройки смен и часов работы"
              >
                <SettingsIcon size={20} />
                <span>Настройки</span>
              </Link>
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Home size={20} />
                <span>Главная</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-md mb-6">
          <nav className="flex border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 text-gray-600">
              Загрузка смен...
            </div>
          ) : (
            <>
              {activeTab === 'schedule' && (
                <ScheduleCalendar
                  employees={employees}
                  shifts={shifts}
                  schedule={schedule}
                  onScheduleChange={handleScheduleChange}
                  onScheduleRemove={handleScheduleRemove}
                />
              )}

              {activeTab === 'employees' && (
                <EmployeeManager
                  employees={employees}
                  onAddEmployee={handleAddEmployee}
                  onEditEmployee={handleEditEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                />
              )}
            </>
          )}
        </div>
      </div>

      <footer className="mt-12 py-6 text-center text-gray-600 text-sm">
        <p>RaboTA © {new Date().getFullYear()} | Система управления графиком работы</p>
      </footer>
    </div>
  );
}
