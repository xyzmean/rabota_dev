import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { ValidationRule, ValidationRuleType, EnforcementType, Employee } from '../types';

interface ValidationRuleModalProps {
  rule: ValidationRule | null;
  employees: Employee[];
  onSave: (rule: Omit<ValidationRule, 'id'> & { id?: number }) => Promise<void>;
  onClose: () => void;
}

const RULE_TYPE_LABELS: Record<ValidationRuleType, string> = {
  max_consecutive_shifts: 'Максимальное кол-во смен подряд',
  min_employees_per_shift: 'Минимум сотрудников в смене',
  max_employees_per_shift: 'Максимум сотрудников в смене',
  max_employees_per_shift_type: 'Максимум людей в конкретной смене',
  required_coverage: 'Обязательное покрытие часов/дней',
  manager_requirements: 'Требования к УМ/ЗУМ',
  max_total_hours: 'Максимум часов в месяц (все)',
  max_hours_without_managers: 'Максимум часов (без УМ/ЗУМ)',
  employee_hours_limit: 'Ограничение часов для сотрудника',
  recommended_work_days: 'Рекомендуемое кол-во рабочих дней',
  required_work_days: 'Конкретные рабочие дни недели',
  coverage_by_time: 'Покрытие по времени',
  coverage_by_day: 'Покрытие по дням',
  shift_type_limit_per_day: 'Лимит типа смены в день',
  max_consecutive_work_days: 'Максимум рабочих дней подряд',
  max_consecutive_days_off: 'Максимум выходных дней подряд',
  employee_day_off: 'Выходной день для сотрудника',
};

const ENFORCEMENT_TYPE_LABELS: Record<EnforcementType, string> = {
  warning: 'Предупреждение (желтый)',
  error: 'Ошибка (красный)',
  info: 'Информация (синий)',
};

export function ValidationRuleModal({ rule, employees, onSave, onClose }: ValidationRuleModalProps) {
  const [ruleType, setRuleType] = useState<ValidationRuleType>(rule?.ruleType || 'max_consecutive_shifts');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [config, setConfig] = useState<Record<string, any>>(rule?.config || {});
  const [appliesToEmployees, setAppliesToEmployees] = useState<string[]>(rule?.appliesToEmployees || []);
  const [enforcementType, setEnforcementType] = useState<EnforcementType>(rule?.enforcementType || 'warning');
  const [customMessage, setCustomMessage] = useState(rule?.customMessage || '');
  const [description, setDescription] = useState(rule?.description || '');

  // Обновляем дефолтный config при смене типа правила
  useEffect(() => {
    if (!rule) {
      // Устанавливаем дефолтный config для нового правила
      const defaultConfigs: Record<ValidationRuleType, Record<string, any>> = {
        max_consecutive_shifts: { max_days: 6 },
        min_employees_per_shift: { min_count: 2 },
        max_employees_per_shift: { max_count: 5 },
        max_employees_per_shift_type: { shift_limits: {} },
        required_coverage: { rules: [] },
        manager_requirements: { min_managers_per_day: 1 },
        max_total_hours: { max_hours_per_month: 176 },
        max_hours_without_managers: { max_hours_per_month: 176 },
        employee_hours_limit: { min_hours: 0, max_hours: 176, enforcement: 'exact' },
        recommended_work_days: { max_consecutive_days: 6, type: 'recommended' },
        required_work_days: { days_of_week: [], applies_to: 'role' },
        coverage_by_time: { time_ranges: [], min_employees: 1, applies_to_weekdays: true, applies_to_weekends: false },
        coverage_by_day: { specific_days: [], min_employees: 1, day_type: 'specific' },
        shift_type_limit_per_day: { shift_limits: {} },
        max_consecutive_work_days: { max_days: 6 },
        max_consecutive_days_off: { max_days: 3 },
        employee_day_off: { employeeId: '', specificDate: '' },
      };
      setConfig(defaultConfigs[ruleType] || {});
    }
  }, [ruleType, rule]);

  const handleConfigChange = (key: string, value: any) => {
    setConfig({ ...config, [key]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ruleData: any = {
      ruleType,
      enabled,
      config,
      appliesToEmployees: appliesToEmployees.length > 0 ? appliesToEmployees : undefined,
      enforcementType,
      customMessage: customMessage.trim() || undefined,
      description: description.trim() || undefined,
    };

    if (rule) {
      ruleData.id = rule.id;
    }

    await onSave(ruleData);
  };

  const toggleEmployee = (employeeId: string) => {
    setAppliesToEmployees(prev =>
      prev.includes(employeeId)
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  // Рендер полей конфигурации в зависимости от типа правила
  const renderConfigFields = () => {
    switch (ruleType) {
      case 'max_consecutive_shifts':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Максимальное количество дней подряд
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={config.max_days || 6}
              onChange={(e) => handleConfigChange('max_days', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        );

      case 'min_employees_per_shift':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Минимальное количество сотрудников
            </label>
            <input
              type="number"
              min="1"
              value={config.min_count || 2}
              onChange={(e) => handleConfigChange('min_count', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        );

      case 'max_employees_per_shift':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Максимальное количество сотрудников
            </label>
            <input
              type="number"
              min="1"
              value={config.max_count || 5}
              onChange={(e) => handleConfigChange('max_count', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        );

      case 'employee_hours_limit':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Минимум часов
              </label>
              <input
                type="number"
                min="0"
                value={config.min_hours || 0}
                onChange={(e) => handleConfigChange('min_hours', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Максимум часов
              </label>
              <input
                type="number"
                min="0"
                value={config.max_hours || 176}
                onChange={(e) => handleConfigChange('max_hours', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Тип применения
              </label>
              <select
                value={config.enforcement || 'exact'}
                onChange={(e) => handleConfigChange('enforcement', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="exact">Точное значение</option>
                <option value="range">Диапазон</option>
              </select>
            </div>
          </div>
        );

      case 'max_total_hours':
      case 'max_hours_without_managers':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Максимум часов в месяц
            </label>
            <input
              type="number"
              min="0"
              value={config.max_hours_per_month || 176}
              onChange={(e) => handleConfigChange('max_hours_per_month', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        );

      case 'recommended_work_days':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Максимальное количество рабочих дней подряд
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={config.max_consecutive_days || 6}
              onChange={(e) => handleConfigChange('max_consecutive_days', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
        );

      case 'max_consecutive_work_days':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Максимальное количество рабочих дней подряд
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={config.max_days || 6}
              onChange={(e) => handleConfigChange('max_days', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Учитываются только дни со сменами (не выходные)
            </p>
          </div>
        );

      case 'max_consecutive_days_off':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Максимальное количество выходных дней подряд
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={config.max_days || 3}
              onChange={(e) => handleConfigChange('max_days', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Учитываются только дни без смен
            </p>
          </div>
        );

      case 'max_employees_per_shift_type':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Лимиты для конкретных смен
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Укажите максимальное количество сотрудников для каждой смены
            </p>
            {/* Это будет расширенная версия в будущем */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Для простоты настройки используйте поле "Применить к конкретным сотрудникам"
              </p>
            </div>
          </div>
        );

      case 'required_coverage':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Правила покрытия
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Эта функция будет доступна в следующих обновлениях
              </p>
            </div>
          </div>
        );

      case 'manager_requirements':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Минимальное количество менеджеров в день
            </label>
            <input
              type="number"
              min="0"
              value={config.min_managers_per_day || 1}
              onChange={(e) => handleConfigChange('min_managers_per_day', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Учитываются только сотрудники с правами управления
            </p>
          </div>
        );

      case 'coverage_by_time':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Покрытие по временным диапазонам
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Эта функция будет доступна в следующих обновлениях
              </p>
            </div>
          </div>
        );

      case 'coverage_by_day':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Покрытие по дням
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Эта функция будет доступна в следующих обновлениях
              </p>
            </div>
          </div>
        );

      case 'shift_type_limit_per_day':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Лимиты типов смен в день
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Эта функция будет доступна в следующих обновлениях
              </p>
            </div>
          </div>
        );

      case 'required_work_days':
        return (
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Обязательные рабочие дни недели
            </label>
            <div className="space-y-2">
              {['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'].map((day, index) => (
                <div key={day} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`day-${index}`}
                    checked={(config.days_of_week || []).includes(index + 1) || (index === 6 && (config.days_of_week || []).includes(0))}
                    onChange={(e) => {
                      const currentDays = config.days_of_week || [];
                      const dayIndex = index === 6 ? 0 : index + 1; // Воскресенье = 0
                      if (e.target.checked) {
                        handleConfigChange('days_of_week', [...currentDays, dayIndex]);
                      } else {
                        handleConfigChange('days_of_week', currentDays.filter((d: number) => d !== dayIndex));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor={`day-${index}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {day}
                  </label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              В эти дни должен быть хотя бы один сотрудник на смене
            </p>
          </div>
        );

      default:
        return (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Конфигурация для этого типа правила будет доступна в следующих обновлениях
            </p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {rule ? 'Редактировать правило' : 'Добавить правило'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Тип правила */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Тип правила *
            </label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as ValidationRuleType)}
              disabled={!!rule}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {Object.entries(RULE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {rule && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Тип правила нельзя изменить после создания
              </p>
            )}
          </div>

          {/* Включено */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="enabled" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Включить правило
            </label>
          </div>

          {/* Конфигурация (зависит от типа) */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Конфигурация</h3>
            {renderConfigFields()}
          </div>

          {/* Тип применения */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Тип применения
            </label>
            <select
              value={enforcementType}
              onChange={(e) => setEnforcementType(e.target.value as EnforcementType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {Object.entries(ENFORCEMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Применить к сотрудникам */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Применить к конкретным сотрудникам (опционально)
            </label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3 space-y-2 bg-gray-50 dark:bg-gray-900/50">
              {employees.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Нет доступных сотрудников</p>
              ) : (
                employees.map((employee) => (
                  <div key={employee.id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`employee-${employee.id}`}
                      checked={appliesToEmployees.includes(employee.id)}
                      onChange={() => toggleEmployee(employee.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor={`employee-${employee.id}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {employee.name}
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Если не выбрано ни одного, правило применяется ко всем
            </p>
          </div>

          {/* Пользовательское сообщение */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Пользовательское сообщение (опционально)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Это сообщение будет показано при нарушении правила"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Описание (опционально)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание правила"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              <Save className="w-5 h-5" />
              {rule ? 'Сохранить изменения' : 'Создать правило'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
