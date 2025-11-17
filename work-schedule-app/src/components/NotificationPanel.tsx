import { useState } from 'react';
import { Bell, BellDot, CheckCircle, XCircle, AlertCircle, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';
import { EmployeePreference, Employee, PreferenceReason } from '../types';

interface NotificationPanelProps {
  preferences: EmployeePreference[];
  employees: Employee[];
  reasons: PreferenceReason[];
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  onViewDetails: (preference: EmployeePreference) => void;
}

export function NotificationPanel({
  preferences,
  employees,
  reasons,
  onApprove,
  onReject,
  onViewDetails,
}: NotificationPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const filteredPreferences = filter === 'all'
    ? preferences
    : preferences.filter(p => p.status === filter);

  const pendingCount = preferences.filter(p => p.status === 'pending').length;

  const getEmployee = (employeeId: string) => {
    return employees.find(e => e.id === employeeId);
  };

  const getReason = (reasonId: number | undefined) => {
    if (!reasonId) return undefined;
    return reasons.find(r => r.id === reasonId);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Не указана';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'short'
    });
  };

  const statusColors = {
    pending: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    approved: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
  };

  const statusLabels = {
    pending: 'Ожидает',
    approved: 'Одобрено',
    rejected: 'Отклонено',
  };

  const statusIcons = {
    pending: <AlertCircle className="w-4 h-4" />,
    approved: <CheckCircle className="w-4 h-4" />,
    rejected: <XCircle className="w-4 h-4" />,
  };

  const handleQuickApprove = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Одобрить этот запрос?')) return;
    await onApprove(id);
  };

  const handleQuickReject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Отклонить этот запрос?')) return;
    await onReject(id);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white cursor-pointer touch-manipulation active:bg-blue-700 dark:active:bg-blue-800 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          {pendingCount > 0 ? (
            <BellDot className="w-5 h-5 md:w-6 md:h-6 animate-pulse flex-shrink-0" />
          ) : (
            <Bell className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
          )}
          <h2 className="text-sm md:text-lg font-semibold truncate">
            Уведомления о запросах
          </h2>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 md:px-2 md:py-1 bg-red-500 dark:bg-red-600 text-white text-xs md:text-xs font-bold rounded-full flex-shrink-0">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-blue-100 dark:text-blue-200">
            {filteredPreferences.length} {filter === 'all' ? 'всего' : statusLabels[filter].toLowerCase()}
          </span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {/* Filters */}
          <div className="flex gap-1.5 md:gap-2 mb-3 md:mb-4 flex-wrap">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-2 py-1.5 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-150 touch-manipulation active:scale-95 ${
                  filter === status
                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500'
                }`}
              >
                {status === 'all' ? 'Все' : statusLabels[status]}
                {status !== 'all' && (
                  <span className="ml-1.5 opacity-75">
                    ({preferences.filter(p => p.status === status).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Requests List */}
          <div className="space-y-3">
            {filteredPreferences.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {filter === 'all' ? 'Нет запросов' : `Нет ${statusLabels[filter].toLowerCase()} запросов`}
                </p>
              </div>
            ) : (
              filteredPreferences
                .sort((a, b) => {
                  // Pending first, then by date
                  if (a.status === 'pending' && b.status !== 'pending') return -1;
                  if (a.status !== 'pending' && b.status === 'pending') return 1;
                  const dateA = a.targetDate ? new Date(a.targetDate).getTime() : 0;
                  const dateB = b.targetDate ? new Date(b.targetDate).getTime() : 0;
                  return dateA - dateB;
                })
                .map((pref) => {
                  const employee = getEmployee(pref.employeeId);
                  const reason = getReason(pref.reasonId);

                  return (
                    <div
                      key={pref.id}
                      onClick={() => onViewDetails(pref)}
                      className="p-3 md:p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-all duration-150 active:bg-gray-100 dark:active:bg-gray-700 active:scale-98 touch-manipulation"
                    >
                      <div className="flex items-start justify-between gap-2 md:gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Employee and Date */}
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {employee?.name || 'Неизвестный сотрудник'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {formatDate(pref.targetDate)}
                            </span>
                          </div>

                          {/* Reason */}
                          {reason && (
                            <div className="flex items-center gap-2 mb-2">
                              {reason.color && (
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: reason.color }}
                                />
                              )}
                              <span className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                {reason.name}
                              </span>
                            </div>
                          )}

                          {/* Notes */}
                          {pref.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 line-clamp-2">
                              {pref.notes}
                            </p>
                          )}
                        </div>

                        {/* Status and Actions */}
                        <div className="flex flex-col items-end gap-2">
                          <div className={`flex items-center gap-1.5 px-1.5 md:px-2 py-1 rounded-lg text-xs font-medium border ${statusColors[pref.status]}`}>
                            {statusIcons[pref.status]}
                            <span className="hidden sm:inline">{statusLabels[pref.status]}</span>
                            <span className="sm:hidden">{statusLabels[pref.status].charAt(0)}</span>
                          </div>

                          {pref.status === 'pending' && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => handleQuickReject(e, pref.id)}
                                className="p-1.5 md:p-1.5 border-2 border-red-500 dark:border-red-400 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150 active:bg-red-100 dark:active:bg-red-900/40 active:scale-95 touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
                                title="Отклонить"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleQuickApprove(e, pref.id)}
                                className="p-1.5 md:p-1.5 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 transition-all duration-150 active:bg-green-700 dark:active:bg-green-800 active:scale-95 touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center"
                                title="Одобрить"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
