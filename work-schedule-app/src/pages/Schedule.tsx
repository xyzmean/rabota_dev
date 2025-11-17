import React, { useState, useEffect } from 'react';
import { Calendar, Users, Home, Settings as SettingsIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import EmployeeManager from '../components/EmployeeManager';
import { ScheduleCalendar } from '../components/ScheduleCalendar';
import { NotificationPanel } from '../components/NotificationPanel';
import { DayOffRequestViewer } from '../components/DayOffRequestViewer';
import { shiftsApi, scheduleApi, employeeApi, preferencesApi, preferenceReasonsApi } from '../services/api';
import { Employee, Shift, ScheduleEntry, EmployeePreference, PreferenceReason } from '../types';

type Tab = 'schedule' | 'employees';

export default function Schedule() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [preferences, setPreferences] = useState<EmployeePreference[]>([]);
  const [reasons, setReasons] = useState<PreferenceReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingRequest, setViewingRequest] = useState<EmployeePreference | null>(null);

  // Load all data from API
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [shiftsData, scheduleData, employeesData, preferencesData, reasonsData] = await Promise.all([
        shiftsApi.getAll(),
        scheduleApi.getAll(),
        employeeApi.getAll(),
        preferencesApi.getAll(),
        preferenceReasonsApi.getAll(),
      ]);
      setShifts(shiftsData);
      setSchedule(scheduleData);
      setEmployees(employeesData);
      setPreferences(preferencesData);
      setReasons(reasonsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Schedule handlers
  const handleScheduleChange = async (newEntry: ScheduleEntry) => {
    try {
      const existingIndex = schedule.findIndex(
        (entry) =>
          entry.employeeId === newEntry.employeeId &&
          entry.day === newEntry.day &&
          entry.month === newEntry.month &&
          entry.year === newEntry.year
      );

      if (existingIndex >= 0) {
        // Update existing entry
        const existingEntry = schedule[existingIndex];
        const updated = await scheduleApi.update(existingEntry.id!, newEntry);
        const updatedSchedule = [...schedule];
        updatedSchedule[existingIndex] = updated;
        setSchedule(updatedSchedule);
      } else {
        // Create new entry
        const created = await scheduleApi.create(newEntry);
        setSchedule([...schedule, created]);
      }
    } catch (err) {
      console.error('Failed to save schedule entry:', err);
      alert('Ошибка при сохранении графика');
    }
  };

  const handleScheduleRemove = async (employeeId: string, day: number, month: number, year: number) => {
    try {
      await scheduleApi.deleteByDateAndEmployee(employeeId, day, month, year);
      setSchedule(
        schedule.filter(
          (entry) =>
            !(entry.employeeId === employeeId && entry.day === day && entry.month === month && entry.year === year)
        )
      );
    } catch (err) {
      console.error('Failed to delete schedule entry:', err);
      alert('Ошибка при удалении записи графика');
    }
  };

  // Reload data when switching to schedule tab
  const handleTabChange = (tabId: Tab) => {
    setActiveTab(tabId);
    if (tabId === 'schedule') {
      loadData(); // Reload data when returning to schedule
    }
  };

  // Request handlers
  const handleApproveRequest = async (id: number) => {
    try {
      await preferencesApi.updateStatus(id, 'approved');
      setPreferences(preferences.map(p => p.id === id ? { ...p, status: 'approved' } : p));
    } catch (err) {
      console.error('Failed to approve request:', err);
      alert('Ошибка при одобрении запроса');
    }
  };

  const handleRejectRequest = async (id: number) => {
    try {
      await preferencesApi.updateStatus(id, 'rejected');
      setPreferences(preferences.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
    } catch (err) {
      console.error('Failed to reject request:', err);
      alert('Ошибка при отклонении запроса');
    }
  };

  const handleViewRequestDetails = (preference: EmployeePreference) => {
    setViewingRequest(preference);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactElement }[] = [
    { id: 'schedule', label: 'График работы', icon: <Calendar size={20} /> },
    { id: 'employees', label: 'Сотрудники', icon: <Users size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Управление графиком работы</h1>
              <p className="text-blue-100 dark:text-blue-200 mt-1 text-sm md:text-base">Современная система планирования рабочих смен</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Link
                to="/settings"
                className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg transition-colors text-sm md:text-base"
                title="Настройки смен и часов работы"
              >
                <SettingsIcon size={18} className="md:w-5 md:h-5" />
                <span className="hidden sm:inline">Настройки</span>
              </Link>
              <Link
                to="/"
                className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg transition-colors text-sm md:text-base"
              >
                <Home size={18} className="md:w-5 md:h-5" />
                <span className="hidden sm:inline">Главная</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Notification Panel */}
        <div className="mb-6">
          <NotificationPanel
            preferences={preferences}
            employees={employees}
            reasons={reasons}
            onApprove={handleApproveRequest}
            onReject={handleRejectRequest}
            onViewDetails={handleViewRequestDetails}
          />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-6">
          <nav className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 md:px-6 py-3 md:py-4 font-medium transition-colors border-b-2 whitespace-nowrap text-sm md:text-base ${
                  activeTab === tab.id
                    ? 'border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <span className="w-5 h-5 flex-shrink-0">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              Загрузка смен...
            </div>
          ) : (
            <>
              {activeTab === 'schedule' && (
                <ScheduleCalendar
                  employees={employees}
                  shifts={shifts}
                  schedule={schedule}
                  preferences={preferences}
                  reasons={reasons}
                  onScheduleChange={handleScheduleChange}
                  onScheduleRemove={handleScheduleRemove}
                  onPreferencesChange={loadData}
                />
              )}

              {activeTab === 'employees' && (
                <EmployeeManager />
              )}
            </>
          )}
        </div>
      </div>

      <footer className="mt-8 md:mt-12 py-4 md:py-6 text-center text-gray-600 dark:text-gray-400 text-xs md:text-sm">
        <p>RaboTA © {new Date().getFullYear()} | Система управления графиком работы</p>
      </footer>

      {/* Day Off Request Viewer Modal */}
      {viewingRequest && (
        <DayOffRequestViewer
          request={viewingRequest}
          employee={employees.find(e => e.id === viewingRequest.employeeId)}
          reason={reasons.find(r => r.id === viewingRequest.reasonId)}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          onClose={() => setViewingRequest(null)}
          canApprove={true}
        />
      )}
    </div>
  );
}
