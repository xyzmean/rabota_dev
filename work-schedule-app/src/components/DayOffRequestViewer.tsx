import { X, CheckCircle, XCircle, Calendar, User, AlertCircle } from 'lucide-react';
import { EmployeePreference, Employee, PreferenceReason } from '../types';

interface DayOffRequestViewerProps {
  request: EmployeePreference;
  employee: Employee | undefined;
  reason: PreferenceReason | undefined;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  onClose: () => void;
  canApprove: boolean; // Может ли текущий пользователь одобрять запросы
}

export function DayOffRequestViewer({
  request,
  employee,
  reason,
  onApprove,
  onReject,
  onClose,
  canApprove,
}: DayOffRequestViewerProps) {
  const statusColors = {
    pending: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700',
    approved: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700',
    rejected: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700',
  };

  const statusLabels = {
    pending: 'Ожидает одобрения',
    approved: 'Одобрено',
    rejected: 'Отклонено',
  };

  const handleApprove = async () => {
    if (!confirm('Одобрить этот запрос на выходной?')) return;
    try {
      await onApprove(request.id);
      onClose();
    } catch (error) {
      console.error('Failed to approve request:', error);
      alert('Ошибка при одобрении запроса');
    }
  };

  const handleReject = async () => {
    if (!confirm('Отклонить этот запрос на выходной?')) return;
    try {
      await onReject(request.id);
      onClose();
    } catch (error) {
      console.error('Failed to reject request:', error);
      alert('Ошибка при отклонении запроса');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 md:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
              Запрос выходного
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-150 active:bg-gray-200 dark:active:bg-gray-600 active:scale-95 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-3 md:space-y-4">
          {/* Employee */}
          <div className="flex items-center gap-3 p-3 md:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Сотрудник</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {employee?.name || 'Не указан'}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3 p-3 md:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-600 dark:text-gray-400">Дата</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {request.targetDate ? formatDate(request.targetDate) : 'Не указана'}
              </p>
            </div>
          </div>

          {/* Reason */}
          {reason && (
            <div className="flex items-start gap-3 p-3 md:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              {reason.color && (
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: reason.color }}
                />
              )}
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">Причина</p>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{reason.name}</p>
                {reason.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{reason.description}</p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Приоритет: {reason.priority}
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {request.notes && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Примечание</p>
              <p className="text-gray-900 dark:text-gray-100">{request.notes}</p>
            </div>
          )}

          {/* Status */}
          <div className={`p-4 rounded-lg border-2 ${statusColors[request.status]}`}>
            <div className="flex items-center gap-2">
              {request.status === 'pending' && <AlertCircle className="w-5 h-5" />}
              {request.status === 'approved' && <CheckCircle className="w-5 h-5" />}
              {request.status === 'rejected' && <XCircle className="w-5 h-5" />}
              <p className="font-semibold">
                Статус: {statusLabels[request.status]}
              </p>
            </div>
          </div>

          {/* Actions */}
          {canApprove && request.status === 'pending' && (
            <div className="flex gap-2 md:gap-3 pt-3 md:pt-4">
              <button
                onClick={handleReject}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-3 md:px-4 md:py-3 border-2 border-red-500 dark:border-red-400 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150 font-semibold active:bg-red-100 dark:active:bg-red-900/40 active:scale-95 touch-manipulation min-h-[48px]"
              >
                <XCircle className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm md:text-base">Отклонить</span>
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-3 md:px-4 md:py-3 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-all duration-150 font-semibold active:bg-green-700 dark:active:bg-green-800 active:scale-95 touch-manipulation min-h-[48px]"
              >
                <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-sm md:text-base">Одобрить</span>
              </button>
            </div>
          )}

          {!canApprove && request.status === 'pending' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Запрос ожидает одобрения от менеджера.
              </p>
            </div>
          )}

          {request.status !== 'pending' && (
            <button
              onClick={onClose}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150 active:bg-gray-100 dark:active:bg-gray-600 active:scale-95 touch-manipulation min-h-[48px]"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
