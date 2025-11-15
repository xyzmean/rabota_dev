import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Employee, Shift, ScheduleEntry } from '../types';

interface ScheduleCalendarProps {
  employees: Employee[];
  shifts: Shift[];
  schedule: ScheduleEntry[];
  onScheduleChange: (entry: ScheduleEntry) => void;
  onScheduleRemove: (employeeId: string, day: number, month: number, year: number) => void;
}

export function ScheduleCalendar({
  employees,
  shifts,
  schedule,
  onScheduleChange,
  onScheduleRemove
}: ScheduleCalendarProps) {
  const [currentDate] = useState(new Date());
  const [month, setMonth] = useState(currentDate.getMonth());
  const [year, setYear] = useState(currentDate.getFullYear());
  const [activeCell, setActiveCell] = useState<{ employeeId: string; day: number; rect?: DOMRect } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

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

    const popupWidth = 200;
    const popupHeight = 300;
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

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
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
    <div className="bg-white rounded-lg shadow-md p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800">График работы</h2>
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <span className="text-base md:text-lg font-semibold min-w-[150px] md:min-w-[200px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Добавьте сотрудников для создания графика работы
        </div>
      ) : (
        <>
          {/* Hours Summary */}
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <h3 className="font-bold text-gray-800 mb-3 text-lg">Статистика часов за {monthNames[month]}:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {employees.map((employee) => {
                const empHours = calculateEmployeeHours(employee.id);
                return (
                  <div key={employee.id} className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="font-semibold text-gray-800 mb-1">
                      {employee.name}
                      {employee.excludeFromHours && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">УМ/ЗУМ</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-bold text-blue-600">{empHours} ч</span>
                    </p>
                  </div>
                );
              })}
            </div>

            {employees.length > 0 && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="font-bold text-gray-800">Часы общие</p>
                    <p className="text-2xl font-bold text-blue-600">{calculateTotalHours().totalHours} ч</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm">
                    <p className="font-bold text-gray-800">Часы без УМ/ЗУМ</p>
                    <p className="text-2xl font-bold text-green-600">{calculateTotalHours().hoursWithoutUMZUM} ч</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Schedule Table */}
          <div className="overflow-x-auto relative -mx-4 md:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="w-full border-collapse text-xs md:text-sm">
                <thead>
                  <tr>
                    <th className="border border-gray-300 bg-gray-100 p-1 md:p-2 text-left font-semibold sticky left-0 z-20 min-w-[80px] md:min-w-[120px]">
                      Сотрудник
                    </th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const date = new Date(year, month, day);
                      const dayOfWeek = date.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                      return (
                        <th
                          key={day}
                          className={`border border-gray-300 p-1 text-center w-8 md:w-12 ${
                            isWeekend ? 'bg-red-50' : 'bg-gray-100'
                          }`}
                        >
                          <div className="text-[10px] md:text-xs text-gray-600">
                            {weekDays[(dayOfWeek === 0 ? 6 : dayOfWeek - 1)]}
                          </div>
                          <div className="font-semibold text-xs md:text-sm">{day}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => {
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-1 md:p-2 font-medium sticky left-0 bg-white z-10">
                          <span className="text-xs md:text-sm">{employee.name}</span>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                          const shift = getScheduleEntry(employee.id, day);
                          const date = new Date(year, month, day);
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          const isActive = activeCell?.employeeId === employee.id && activeCell?.day === day;

                          return (
                            <td
                              key={day}
                              onClick={(e) => handleCellClick(e, employee.id, day)}
                              className={`border border-gray-300 p-0.5 md:p-1 text-center cursor-pointer transition-colors ${
                                isWeekend ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-blue-50'
                              } ${isActive ? 'ring-2 ring-blue-500' : ''}`}
                            >
                              {shift && (
                                <div
                                  className="rounded px-0.5 py-0.5 md:px-1 md:py-1 text-white font-bold text-[10px] md:text-sm"
                                  style={{ backgroundColor: shift.color }}
                                >
                                  {shift.abbreviation}
                                </div>
                              )}
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
                className="bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-3 min-w-[200px] max-w-[250px]"
              >
                <div className="flex items-center justify-between mb-2 pb-2 border-b">
                  <span className="text-xs font-semibold text-gray-700">Выбрать смену</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCell(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
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
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-gray-100 transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.abbreviation}
                      </div>
                      <span className="text-sm text-gray-700 text-left truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
                {getScheduleEntry(activeCell.employeeId, activeCell.day) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveShift();
                    }}
                    className="w-full mt-2 pt-2 border-t text-xs text-red-600 hover:text-red-700 font-medium"
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

          <div className="mt-4 p-3 md:p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm md:text-base">Инструкция:</h3>
            <ul className="text-xs md:text-sm text-gray-700 space-y-1">
              <li>• Кликните на ячейку, чтобы открыть выбор смены</li>
              <li>• Выберите нужную смену из всплывающего меню</li>
              <li>• Красным выделены выходные дни (суббота и воскресенье)</li>
              <li>• Статистика часов отображается вверху таблицы</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
