import { useState, useEffect } from 'react';
import { X, Calendar, User, Edit2 } from 'lucide-react';
import { Employee, PreferenceReason, EmployeePreferenceInput, EmployeePreference } from '../types';

interface DayOffRequestModalProps {
  employees: Employee[];
  reasons: PreferenceReason[];
  request?: EmployeePreference | null; // Для редактирования
  onSave: (request: EmployeePreferenceInput) => Promise<void>;
  onClose: () => void;
  initialDate?: string; // YYYY-MM-DD
  initialEmployeeId?: string;
}

export function DayOffRequestModal({
  employees,
  reasons,
  request,
  onSave,
  onClose,
  initialDate,
  initialEmployeeId,
}: DayOffRequestModalProps) {
  const [employeeId, setEmployeeId] = useState(request?.employeeId || initialEmployeeId || '');
  const [targetDate, setTargetDate] = useState(request?.targetDate || initialDate || '');
  const [reasonId, setReasonId] = useState<number | undefined>(request?.reasonId || undefined);
  const [notes, setNotes] = useState(request?.notes || '');
  const [saving, setSaving] = useState(false);

  const isEditing = !!request;

  useEffect(() => {
    // Set default reason to the highest priority one
    if (reasons.length > 0 && !reasonId) {
      const sortedReasons = [...reasons].sort((a, b) => b.priority - a.priority);
      setReasonId(sortedReasons[0].id);
    }
  }, [reasons, reasonId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeId || !targetDate) {
      alert('Заполните все обязательные поля');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        employeeId,
        preferenceType: 'day_off',
        targetDate,
        reasonId,
        priority: reasonId ? reasons.find(r => r.id === reasonId)?.priority : 50,
        status: 'pending',
        notes: notes || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save request:', error);
      alert('Ошибка при сохранении запроса');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {isEditing && <Edit2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isEditing ? 'Редактирование запроса' : 'Новый запрос выходного'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Employee Select */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              <User className="w-4 h-4" />
              Сотрудник *
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={!!initialEmployeeId || isEditing}
            >
              <option value="">Выберите сотрудника</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Select */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              <Calendar className="w-4 h-4" />
              Дата *
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Reason Select */}
          {reasons.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Причина
              </label>
              <select
                value={reasonId || ''}
                onChange={(e) => setReasonId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Без причины</option>
                {[...reasons]
                  .sort((a, b) => b.priority - a.priority)
                  .map((reason) => (
                    <option key={reason.id} value={reason.id}>
                      {reason.name} (приоритет: {reason.priority})
                    </option>
                  ))}
              </select>
              {reasonId && (
                <div className="mt-2 flex items-center gap-2">
                  {reasons.find(r => r.id === reasonId)?.color && (
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: reasons.find(r => r.id === reasonId)?.color }}
                    />
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {reasons.find(r => r.id === reasonId)?.description}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Примечание (необязательно)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Дополнительная информация о запросе..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Status Info */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Статус:</strong> Ожидает одобрения
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              После создания запроса, менеджер сможет одобрить или отклонить его.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Сохранение...' : 'Создать запрос'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
