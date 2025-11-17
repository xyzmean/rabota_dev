import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Employee, Shift, ScheduleEntry, ValidationViolation, ScheduleValidationResult, EmployeePreference, PreferenceReason } from '../types';
import { scheduleApi, preferencesApi, validationRulesApi } from '../services/api';
import { DayOffRequestViewer } from './DayOffRequestViewer';

interface ScheduleCalendarProps {
  employees: Employee[];
  shifts: Shift[];
  schedule: ScheduleEntry[];
  preferences: EmployeePreference[];
  reasons: PreferenceReason[];
  onScheduleChange: (entry: ScheduleEntry) => void;
  onScheduleRemove: (employeeId: string, day: number, month: number, year: number) => void;
  onPreferencesChange: () => void;
}

export function ScheduleCalendar({
  employees,
  shifts,
  schedule,
  preferences,
  reasons,
  onScheduleChange,
  onScheduleRemove,
  onPreferencesChange
}: ScheduleCalendarProps) {
  const today = new Date();
  const [currentDate] = useState(today);
  const [month, setMonth] = useState(currentDate.getMonth());
  const [year, setYear] = useState(currentDate.getFullYear());
  const [activeCell, setActiveCell] = useState<{ employeeId: string; day: number; rect?: DOMRect } | null>(null);
  const [validationResult, setValidationResult] = useState<ScheduleValidationResult | null>(null);
  const [viewingRequest, setViewingRequest] = useState<EmployeePreference | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Load validation results when month/year/schedule changes
  useEffect(() => {
    const loadValidation = async () => {
      try {
        const result = await scheduleApi.validate(month, year);
        setValidationResult(result);
      } catch (error) {
        console.error('Failed to load validation:', error);
        setValidationResult(null);
      }
    };

    loadValidation();
  }, [month, year, schedule]);

  // Helper function to check if a date is today
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Get violations for a specific cell
  const getCellViolations = (employeeId: string, day: number): ValidationViolation[] => {
    if (!validationResult) return [];

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return validationResult.violations.filter(v => {
      // Violations can be for specific employee and/or date
      const matchesEmployee = !v.employeeId || v.employeeId === employeeId;
      const matchesDate = !v.date || v.date === dateStr;
      return matchesEmployee && matchesDate;
    });
  };

  // Get cell background color based on violations
  const getCellClassName = (employeeId: string, day: number, baseClass: string): string => {
    const violations = getCellViolations(employeeId, day);
    if (violations.length === 0) return baseClass;

    // Priority: error > warning > info
    const hasError = violations.some(v => v.severity === 'error');
    const hasWarning = violations.some(v => v.severity === 'warning');

    if (hasError) {
      return baseClass + ' bg-red-100 dark:bg-red-900/40 border-2 border-red-500 dark:border-red-400';
    } else if (hasWarning) {
      return baseClass + ' bg-yellow-100 dark:bg-yellow-900/40 border-2 border-yellow-500 dark:border-yellow-400';
    } else {
      return baseClass + ' bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 dark:border-blue-400';
    }
  };

  // Get day-off requests for a specific date
  const getPendingRequests = (employeeId: string, day: number): EmployeePreference | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return preferences.find(p => {
      // targetDate from API is in ISO format: "2025-11-20T00:00:00.000Z"
      // We need to compare only the date part
      if (!p.targetDate) return false;
      const prefDate = p.targetDate.split('T')[0]; // Extract "2025-11-20"
      return (
        p.employeeId === employeeId &&
        prefDate === dateStr &&
        p.preferenceType === 'day_off' &&
        p.status === 'pending'
      );
    });
  };

  // Get approved day-off requests for a specific date
  const getApprovedRequests = (employeeId: string, day: number): EmployeePreference | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return preferences.find(p => {
      if (!p.targetDate) return false;
      const prefDate = p.targetDate.split('T')[0];
      return (
        p.employeeId === employeeId &&
        prefDate === dateStr &&
        p.preferenceType === 'day_off' &&
        p.status === 'approved'
      );
    });
  };

  // Handle request approval
  const handleApproveRequest = async (id: number) => {
    try {
      // Сначала найдем запрос для получения информации
      const request = preferences.find(p => p.id === id);
      if (!request) return;

      // Обновим статус запроса
      await preferencesApi.updateStatus(id, 'approved');

      // Создадим правило валидации для подтвержденного выходного
      const targetDate = new Date(request.targetDate!);
      const employee = employees.find(e => e.id === request.employeeId);

      if (employee) {
        const ruleData = {
          ruleType: 'required_work_days' as const,
          enabled: true,
          config: {
            employeeId: request.employeeId,
            dayOfWeek: targetDate.getDay(), // 0 = Sunday, 1 = Monday, etc.
            specificDate: request.targetDate, // YYYY-MM-DD format
            action: 'day_off' // Выходной
          },
          appliesToEmployees: [request.employeeId],
          enforcementType: 'error' as const,
          customMessage: `Выходной для ${employee.name} (${request.targetDate})`,
          priority: 1, // Высший приоритет
          description: `Автоматически созданное правило для выходного дня сотрудника ${employee.name}`
        };

        // Создаем правило с высшим приоритетом
        const newRule = await validationRulesApi.create(ruleData);

        // Обновим приоритеты всех существующих правил, чтобы новое правило было первым
        try {
          const existingRules = await validationRulesApi.getAll();
          const rulesToUpdate = existingRules
            .filter(r => r.id !== newRule.id)
            .sort((a, b) => a.priority - b.priority)
            .map((rule, index) => ({
              ...rule,
              priority: index + 2 // Новые приоритеты: 2, 3, 4, ...
            }));

          // Обновляем приоритеты для каждого правила
          for (const rule of rulesToUpdate) {
            await validationRulesApi.update(rule.id, {
              ...rule,
              priority: rule.priority
            });
          }
        } catch (priorityError) {
          console.warn('Failed to update rule priorities:', priorityError);
          // Правило создано, но приоритеты не обновлены - не критично
        }
      }

      onPreferencesChange(); // Reload preferences from parent
    } catch (error) {
      console.error('Failed to approve request:', error);
      throw error;
    }
  };

  // Handle request rejection
  const handleRejectRequest = async (id: number) => {
    try {
      await preferencesApi.updateStatus(id, 'rejected');
      onPreferencesChange(); // Reload preferences from parent
    } catch (error) {
      console.error('Failed to reject request:', error);
      throw error;
    }
  };

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const goToPreviousMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const getScheduleEntry = (employeeId: string, day: number): Shift | null => {
    const entry = schedule.find(
      (e) => e.employeeId === employeeId && e.day === day && e.month === month && e.year === year
    );
    if (entry) {
      return shifts.find((s) => s.id === entry.shiftId) || null;
    }
    return null;
  };

  const handleCellClick = (e: React.MouseEvent<HTMLTableCellElement>, employeeId: string, day: number) => {
    if (shifts.length === 0) {
      alert('Сначала создайте смены в разделе "Управление сменами"');
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setActiveCell({ employeeId, day, rect });
  };

  const handleShiftSelect = (shiftId: string) => {
    if (activeCell) {
      onScheduleChange({
        employeeId: activeCell.employeeId,
        day: activeCell.day,
        month,
        year,
        shiftId
      });
      setActiveCell(null);
    }
  };

  const handleRemoveShift = () => {
    if (activeCell) {
      onScheduleRemove(activeCell.employeeId, activeCell.day, month, year);
      setActiveCell(null);
    }
  };

  // Calculate position for popup to keep it in viewport
  const getPopupStyle = (): React.CSSProperties => {
    if (!activeCell?.rect) return {};

    const isMobile = window.innerWidth < 768;
    const popupWidth = isMobile ? Math.min(window.innerWidth - 20, 280) : 200;
    const popupHeight = isMobile ? Math.min(window.innerHeight - 100, 400) : 300;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = activeCell.rect.left + activeCell.rect.width / 2 - popupWidth / 2;
    let top = activeCell.rect.bottom + 8;

    // Adjust horizontal position
    if (left < 10) left = 10;
    if (left + popupWidth > viewportWidth - 10) {
      left = viewportWidth - popupWidth - 10;
    }

    // Adjust vertical position - show above if no space below
    if (top + popupHeight > viewportHeight - 10) {
      top = activeCell.rect.top - popupHeight - 8;
    }

    // Ensure popup doesn't go above screen
    if (top < 10) {
      top = 10;
    }

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      width: `${popupWidth}px`,
      maxHeight: `${popupHeight}px`,
      zIndex: 50
    };
  };

  const calculateEmployeeHours = (employeeId: string) => {
    const employeeSchedule = schedule.filter(
      (e) => e.employeeId === employeeId && e.month === month && e.year === year
    );

    let totalHours = 0;

    employeeSchedule.forEach((entry) => {
      const shift = shifts.find((s) => s.id === entry.shiftId);
      if (shift) {
        totalHours += shift.hours; // Use shift's configured hours
      }
    });

    return totalHours;
  };

  const calculateTotalHours = () => {
    let totalHours = 0;
    let hoursWithoutUMZUM = 0;

    employees.forEach((employee) => {
      const empHours = calculateEmployeeHours(employee.id);
      totalHours += empHours;

      // If employee is not УМ/ЗУМ, add to working hours
      if (!employee.excludeFromHours) {
        hoursWithoutUMZUM += empHours;
      }
    });

    return { totalHours, hoursWithoutUMZUM };
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100">График работы</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-800 dark:text-gray-200" />
          </button>
          <span className="text-base md:text-lg font-semibold min-w-[120px] md:min-w-[200px] text-center text-gray-800 dark:text-gray-100">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight size={24} className="text-gray-800 dark:text-gray-200" />
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Добавьте сотрудников для создания графика работы
        </div>
      ) : (
        <>
          {/* Hours Summary */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3 text-lg">Статистика часов за {monthNames[month]}:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {employees.map((employee) => {
                const empHours = calculateEmployeeHours(employee.id);
                return (
                  <div key={employee.id} className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm">
                    <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">
                      {employee.name}
                      {employee.excludeFromHours && (
                        <span className="ml-2 text-xs bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">УМ/ЗУМ</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{empHours} ч</span>
                    </p>
                  </div>
                );
              })}
            </div>

            {employees.length > 0 && (
              <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm">
                    <p className="font-bold text-gray-800 dark:text-gray-100">Часы общие</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{calculateTotalHours().totalHours} ч</p>
                  </div>
                  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm">
                    <p className="font-bold text-gray-800 dark:text-gray-100">Часы без УМ/ЗУМ</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{calculateTotalHours().hoursWithoutUMZUM} ч</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Validation Legend */}
          {validationResult && validationResult.violations.length > 0 && (
            <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={20} className="text-orange-600 dark:text-orange-400" />
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">
                  Обнаружены нарушения правил ({validationResult.violations.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 bg-red-100 dark:bg-red-900/40 border-2 border-red-500 dark:border-red-400 rounded"></div>
                  <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
                  <span className="text-gray-700 dark:text-gray-300">Ошибка</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/40 border-2 border-yellow-500 dark:border-yellow-400 rounded"></div>
                  <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400" />
                  <span className="text-gray-700 dark:text-gray-300">Предупреждение</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-500 dark:border-blue-400 rounded"></div>
                  <Info size={16} className="text-blue-600 dark:text-blue-400" />
                  <span className="text-gray-700 dark:text-gray-300">Информация</span>
                </div>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-orange-700 dark:text-orange-300 font-semibold hover:text-orange-800 dark:hover:text-orange-200">
                  Показать все нарушения ({validationResult.violations.length})
                </summary>
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {validationResult.violations.map((violation, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                      {violation.severity === 'error' ? (
                        <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      ) : violation.severity === 'warning' ? (
                        <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Info size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="text-gray-800 dark:text-gray-200">{violation.message}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Schedule Table */}
          <div className="overflow-x-auto relative -mx-4 md:mx-0 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800">
            {/* Mobile scroll indicator */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-100 dark:from-gray-800 to-transparent z-30 pointer-events-none md:hidden"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100 dark:from-gray-800 to-transparent z-30 pointer-events-none md:hidden"></div>
            <div className="inline-block min-w-full align-middle">
              <table className="w-full border-collapse text-xs md:text-sm select-none">
                <thead>
                  <tr>
                    <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-1 md:p-2 text-left font-semibold sticky left-0 z-20 min-w-[80px] md:min-w-[120px] text-gray-800 dark:text-gray-100">
                      Сотрудник
                    </th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const date = new Date(year, month, day);
                      const dayOfWeek = date.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isTodayDate = isToday(day);

                      return (
                        <th
                          key={day}
                          className={`border border-gray-300 dark:border-gray-600 p-1 text-center w-8 md:w-12 ${
                            isTodayDate
                              ? 'bg-green-200 dark:bg-green-700 ring-2 ring-green-500 dark:ring-green-400'
                              : isWeekend
                                ? 'bg-red-50 dark:bg-red-900/30'
                                : 'bg-gray-100 dark:bg-gray-700'
                          }`}
                        >
                          <div className={`text-[10px] md:text-xs ${isTodayDate ? 'text-green-800 dark:text-green-200 font-bold' : 'text-gray-600 dark:text-gray-400'}`}>
                            {weekDays[(dayOfWeek === 0 ? 6 : dayOfWeek - 1)]}
                          </div>
                          <div className={`font-semibold text-xs md:text-sm ${isTodayDate ? 'text-green-900 dark:text-green-100' : 'text-gray-800 dark:text-gray-200'}`}>{day}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="border border-gray-300 dark:border-gray-600 p-1 md:p-2 font-medium sticky left-0 bg-white dark:bg-gray-800 z-10">
                          <span className="text-xs md:text-sm text-gray-800 dark:text-gray-200">{employee.name}</span>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                          const shift = getScheduleEntry(employee.id, day);
                          const date = new Date(year, month, day);
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          const isActive = activeCell?.employeeId === employee.id && activeCell?.day === day;
                          const isTodayDate = isToday(day);
                          const violations = getCellViolations(employee.id, day);
                          const pendingRequest = getPendingRequests(employee.id, day);
                          const approvedRequest = getApprovedRequests(employee.id, day);

                          let baseClassName = 'border border-gray-300 dark:border-gray-600 p-0.5 md:p-1 text-center cursor-pointer transition-all duration-150 touch-manipulation ';
                          if (isTodayDate) {
                            baseClassName += 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 active:bg-green-300 dark:active:bg-green-800/70 ring-1 ring-inset ring-green-500 dark:ring-green-400 active:scale-95 md:hover:scale-100';
                          } else if (isWeekend) {
                            baseClassName += 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 active:bg-red-200 dark:active:bg-red-900/60 active:scale-95 md:hover:scale-100';
                          } else {
                            baseClassName += 'bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 dark:active:bg-blue-900/40 active:scale-95 md:hover:scale-100';
                          }

                          const cellClassName = getCellClassName(employee.id, day, baseClassName);

                          return (
                            <td
                              key={day}
                              onClick={(e) => handleCellClick(e, employee.id, day)}
                              className={`${cellClassName} ${isActive ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}`}
                              title={violations.length > 0 ? violations.map(v => v.message).join('\n') : undefined}
                            >
                              <div className="relative">
                                {shift && (
                                  <div
                                    className="rounded px-0.5 py-0.5 md:px-1 md:py-1 text-white font-bold text-[10px] md:text-sm"
                                    style={{ backgroundColor: shift.color }}
                                  >
                                    {shift.abbreviation}
                                  </div>
                                )}
                                {violations.length > 0 && (
                                  <div className="absolute top-0 right-0 -mt-1 -mr-1">
                                    {violations.some(v => v.severity === 'error') ? (
                                      <AlertCircle size={12} className="text-red-600 dark:text-red-400" />
                                    ) : violations.some(v => v.severity === 'warning') ? (
                                      <AlertTriangle size={12} className="text-yellow-600 dark:text-yellow-400" />
                                    ) : (
                                      <Info size={12} className="text-blue-600 dark:text-blue-400" />
                                    )}
                                  </div>
                                )}
                                {pendingRequest && (
                                  <div
                                    className="absolute bottom-0 left-0 w-2 h-2 rounded-full bg-red-600 dark:bg-red-500 cursor-pointer hover:scale-125 transition-transform"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingRequest(pendingRequest);
                                    }}
                                    title="Ожидающий запрос на выходной"
                                    style={{ left: '2px' }}
                                  />
                                )}
                                {approvedRequest && (
                                  <div
                                    className="absolute bottom-0 left-0 w-2 h-2 rounded-full bg-green-600 dark:bg-green-500 cursor-pointer hover:scale-125 transition-transform"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingRequest(approvedRequest);
                                    }}
                                    title="Подтвержденный выходной"
                                    style={{ left: pendingRequest ? '6px' : '2px' }}
                                  />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shift Selector Popup */}
          {activeCell && (
            <>
              <div
                ref={popupRef}
                style={getPopupStyle()}
                className="bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded-lg shadow-2xl p-3 md:p-3 overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Выбрать смену</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCell(null);
                    }}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {shifts.map((s) => (
                    <button
                      key={s.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShiftSelect(s.id);
                      }}
                      className="w-full flex items-center gap-2 md:gap-2 p-3 md:p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-all duration-150 touch-manipulation active:scale-95 min-h-[44px]"
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.abbreviation}
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-200 text-left truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
                {getScheduleEntry(activeCell.employeeId, activeCell.day) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveShift();
                    }}
                    className="w-full mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium"
                  >
                    Удалить смену
                  </button>
                )}
              </div>

              {/* Click outside to close */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActiveCell(null)}
              />
            </>
          )}

          <div className="mt-4 p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 text-sm md:text-base">Инструкция:</h3>
            <ul className="text-xs md:text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>• Кликните на ячейку, чтобы открыть выбор смены</li>
              <li>• Выберите нужную смену из всплывающего меню</li>
              <li>• <span className="font-semibold text-green-700 dark:text-green-400">Зеленым</span> выделена текущая дата</li>
              <li>• <span className="font-semibold text-red-700 dark:text-red-400">Красным</span> выделены выходные дни (суббота и воскресенье)</li>
              <li>• <span className="inline-block w-2 h-2 rounded-full bg-red-600 dark:bg-red-500"></span> Красная точка - ожидающий запрос на выходной (кликните для просмотра)</li>
              <li>• <span className="inline-block w-2 h-2 rounded-full bg-green-600 dark:bg-green-500"></span> Зеленая точка - подтвержденный выходной (кликните для просмотра)</li>
              <li>• При подтверждении запроса автоматически создается правило с высшим приоритетом</li>
              <li>• Статистика часов отображается вверху таблицы</li>
            </ul>
          </div>
        </>
      )}

      {/* Day Off Request Viewer */}
      {viewingRequest && (
        <DayOffRequestViewer
          request={viewingRequest}
          employee={employees.find(e => e.id === viewingRequest.employeeId)}
          reason={reasons.find(r => r.id === viewingRequest.reasonId)}
          onApprove={handleApproveRequest}
          onReject={handleRejectRequest}
          onClose={() => setViewingRequest(null)}
          canApprove={true} // TODO: Implement role-based permissions
        />
      )}
    </div>
  );
}
