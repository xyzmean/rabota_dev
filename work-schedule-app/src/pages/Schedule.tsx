import { useState, useEffect } from 'react';
import { Calendar, Users, Clock, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ShiftManager } from '../components/ShiftManager';
import { EmployeeManager } from '../components/EmployeeManager';
import { ScheduleCalendar } from '../components/ScheduleCalendar';
import { Employee, Shift, ScheduleEntry } from '../types';

type Tab = 'schedule' | 'shifts' | 'employees';

const DEFAULT_WEEKEND_SHIFT: Omit<Shift, 'id'> = {
  name: 'Выходной',
  abbreviation: 'В',
  color: '#EF4444',
  hours: 0,
  isDefault: true
};

export default function Schedule() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [shifts, setShifts] = useLocalStorage<Shift[]>('workSchedule_shifts', []);
  const [employees, setEmployees] = useLocalStorage<Employee[]>('workSchedule_employees', []);
  const [schedule, setSchedule] = useLocalStorage<ScheduleEntry[]>('workSchedule_schedule', []);

  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Initialize with default weekend shift if no shifts exist
  useEffect(() => {
    if (shifts.length === 0) {
      const defaultShift: Shift = { ...DEFAULT_WEEKEND_SHIFT, id: generateId() };
      setShifts([defaultShift]);
    }
  }, []);

  // Shift handlers
  const handleAddShift = (shiftData: Omit<Shift, 'id'>) => {
    const newShift: Shift = { ...shiftData, id: generateId() };
    setShifts([...shifts, newShift]);
  };

  const handleEditShift = (id: string, shiftData: Omit<Shift, 'id'>) => {
    setShifts(shifts.map((shift) => (shift.id === id ? { ...shiftData, id } : shift)));
  };

  const handleDeleteShift = (id: string) => {
    if (confirm('Удалить эту смену? Все назначения этой смены в графике будут удалены.')) {
      setShifts(shifts.filter((shift) => shift.id !== id));
      setSchedule(schedule.filter((entry) => entry.shiftId !== id));
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
    { id: 'shifts', label: 'Смены', icon: <Clock size={20} /> },
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
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Home size={20} />
              <span>Главная</span>
            </Link>
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
          {activeTab === 'schedule' && (
            <ScheduleCalendar
              employees={employees}
              shifts={shifts}
              schedule={schedule}
              onScheduleChange={handleScheduleChange}
              onScheduleRemove={handleScheduleRemove}
            />
          )}

          {activeTab === 'shifts' && (
            <ShiftManager
              shifts={shifts}
              onAddShift={handleAddShift}
              onEditShift={handleEditShift}
              onDeleteShift={handleDeleteShift}
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
        </div>
      </div>

      <footer className="mt-12 py-6 text-center text-gray-600 text-sm">
        <p>RaboTA © {new Date().getFullYear()} | Система управления графиком работы</p>
      </footer>
    </div>
  );
}
