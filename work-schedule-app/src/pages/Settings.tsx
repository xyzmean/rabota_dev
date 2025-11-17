import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, ToggleLeft, ToggleRight, Edit } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import DraggableList from '../components/DraggableList';
import { ShiftManager } from '../components/ShiftManager';
import { ValidationRuleModal } from '../components/ValidationRuleModal';
import { PreferenceReasonModal } from '../components/PreferenceReasonModal';
import { validationRulesApi, preferenceReasonsApi, settingsApi, shiftsApi, employeeApi } from '../services/api';
import type { ValidationRule, PreferenceReason, Shift, Employee } from '../types';

type Tab = 'general' | 'shifts' | 'rules' | 'reasons';

const RULE_LABELS: Record<string, string> = {
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
};

export default function Settings() {
  const [tab, setTab] = useState<Tab>('general');
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [reasons, setReasons] = useState<PreferenceReason[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [businessHoursStart, setBusinessHoursStart] = useState('08:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('22:00');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<PreferenceReason | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, reasonsData, shiftsData, employeesData, businessHoursData] = await Promise.all([
        validationRulesApi.getAll(),
        preferenceReasonsApi.getAll(),
        shiftsApi.getAll(),
        employeeApi.getAll(),
        settingsApi.getBulk(['business_hours_start', 'business_hours_end']),
      ]);
      setRules(rulesData);
      setReasons(reasonsData);
      setShifts(shiftsData);
      setEmployees(employeesData);

      // Загружаем часы работы
      const startSetting = businessHoursData.find(s => s.key === 'business_hours_start');
      const endSetting = businessHoursData.find(s => s.key === 'business_hours_end');
      if (startSetting) setBusinessHoursStart(JSON.parse(startSetting.value));
      if (endSetting) setBusinessHoursEnd(JSON.parse(endSetting.value));
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRulesReorder = async (newRules: ValidationRule[]) => {
    setRules(newRules);
    try {
      const orderedIds = newRules.map(r => r.id);
      await validationRulesApi.reorder(orderedIds);
    } catch (err) {
      console.error('Failed to reorder rules:', err);
      loadData();
    }
  };

  const handleReasonsReorder = async (newReasons: PreferenceReason[]) => {
    setReasons(newReasons);
    try {
      const orderedIds = newReasons.map(r => r.id);
      await preferenceReasonsApi.reorder(orderedIds);
    } catch (err) {
      console.error('Failed to reorder reasons:', err);
      loadData();
    }
  };

  const toggleRule = async (id: number) => {
    try {
      const updated = await validationRulesApi.toggle(id);
      setRules(rules.map(r => r.id === id ? updated : r));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const deleteReason = async (id: number) => {
    if (!confirm('Удалить причину?')) return;
    try {
      await preferenceReasonsApi.delete(id);
      setReasons(reasons.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete reason:', err);
    }
  };

  const handleSaveReason = async (reasonData: {
    name: string;
    priority: number;
    color: string;
    description: string;
  }) => {
    if (editingReason) {
      // Update existing reason
      const updated = await preferenceReasonsApi.update(editingReason.id, reasonData);
      setReasons(reasons.map(r => r.id === editingReason.id ? updated : r));
    } else {
      // Create new reason
      const created = await preferenceReasonsApi.create(reasonData);
      setReasons([...reasons, created]);
    }
  };

  // Shift handlers
  const handleAddShift = async (shiftData: Omit<Shift, 'id'>) => {
    try {
      const newShift = await shiftsApi.create({
        ...shiftData,
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
      setShifts([...shifts, newShift]);
    } catch (err) {
      console.error('Failed to add shift:', err);
      alert('Ошибка при добавлении смены');
    }
  };

  const handleEditShift = async (id: string, shiftData: Omit<Shift, 'id'>) => {
    try {
      const updated = await shiftsApi.update(id, shiftData);
      setShifts(shifts.map(s => s.id === id ? updated : s));
    } catch (err) {
      console.error('Failed to update shift:', err);
      alert('Ошибка при обновлении смены');
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Удалить эту смену? Все назначения этой смены в графике будут удалены.')) return;
    try {
      await shiftsApi.delete(id);
      setShifts(shifts.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete shift:', err);
      alert('Ошибка при удалении смены');
    }
  };

  // Business hours handlers
  const saveBusinessHours = async () => {
    setSaving(true);
    try {
      // Используем upsert логику - пытаемся обновить, если не получается - создаём
      const saveOne = async (key: string, value: string, description: string) => {
        try {
          await settingsApi.update(key, value, description);
        } catch (err: any) {
          // Если настройка не найдена, создаём её
          if (err.status === 404) {
            await settingsApi.create({ key, value, description });
          } else {
            throw err;
          }
        }
      };

      await Promise.all([
        saveOne(
          'business_hours_start',
          JSON.stringify(businessHoursStart),
          'Время начала работы предприятия'
        ),
        saveOne(
          'business_hours_end',
          JSON.stringify(businessHoursEnd),
          'Время окончания работы предприятия'
        ),
      ]);
      alert('Часы работы сохранены');
    } catch (err) {
      console.error('Failed to save business hours:', err);
      alert('Ошибка при сохранении часов работы');
    } finally {
      setSaving(false);
    }
  };

  // Validation rules handlers
  const handleAddRule = () => {
    setEditingRule(null);
    setRuleModalOpen(true);
  };

  const handleEditRule = (rule: ValidationRule) => {
    setEditingRule(rule);
    setRuleModalOpen(true);
  };

  const handleSaveRule = async (ruleData: Omit<ValidationRule, 'id'> & { id?: number }) => {
    try {
      if (ruleData.id) {
        // Обновляем существующее правило
        const updated = await validationRulesApi.update(ruleData.id, ruleData);
        setRules(rules.map(r => r.id === ruleData.id ? updated : r));
      } else {
        // Создаём новое правило
        const newRule = await validationRulesApi.create(ruleData);
        setRules([...rules, newRule]);
      }
      setRuleModalOpen(false);
      setEditingRule(null);
    } catch (err) {
      console.error('Failed to save rule:', err);
      alert('Ошибка при сохранении правила');
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Удалить это правило валидации?')) return;
    try {
      await validationRulesApi.delete(id);
      setRules(rules.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete rule:', err);
      alert('Ошибка при удалении правила');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 text-white p-3 md:p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/" className="hover:bg-white/10 p-2 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Настройки</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex gap-1 md:gap-2 mb-4 md:mb-6 border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
          {[
            { id: 'general', label: 'Общие' },
            { id: 'shifts', label: 'Часы работы и смены' },
            { id: 'rules', label: 'Правила валидации' },
            { id: 'reasons', label: 'Причины запросов' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`px-3 md:px-4 py-2 font-medium transition whitespace-nowrap text-sm md:text-base ${
                tab === id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400">Загрузка...</div>
        ) : (
          <>
            {tab === 'general' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">Основные настройки</h2>
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Тема оформления</label>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Используйте переключатель в шапке для смены темы</p>
                  </div>
                </div>
              </div>
            )}

            {tab === 'shifts' && (
              <div className="space-y-6">
                {/* Business Hours Section */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
                  <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">
                    Часы работы предприятия
                  </h2>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 md:mb-4">
                    Установите время начала и окончания работы предприятия
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Начало работы
                      </label>
                      <input
                        type="time"
                        value={businessHoursStart}
                        onChange={(e) => setBusinessHoursStart(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Окончание работы
                      </label>
                      <input
                        type="time"
                        value={businessHoursEnd}
                        onChange={(e) => setBusinessHoursEnd(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <button
                    onClick={saveBusinessHours}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base w-full sm:w-auto"
                  >
                    <Save className="w-4 h-4 md:w-5 md:h-5" />
                    <span>{saving ? 'Сохранение...' : 'Сохранить часы работы'}</span>
                  </button>
                </div>

                {/* Shifts Manager Section */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
                  <ShiftManager
                    shifts={shifts}
                    onAddShift={handleAddShift}
                    onEditShift={handleEditShift}
                    onDeleteShift={handleDeleteShift}
                  />
                </div>
              </div>
            )}

            {tab === 'rules' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                  <div className="flex-1">
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
                      Правила валидации графика
                    </h2>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Перетаскивайте правила для изменения приоритета (верхние = выше приоритет)
                    </p>
                  </div>
                  <button
                    onClick={handleAddRule}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm md:text-base w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden sm:inline">Добавить правило</span>
                    <span className="sm:hidden">Добавить</span>
                  </button>
                </div>
                <DraggableList
                  items={rules}
                  getId={r => r.id}
                  onReorder={handleRulesReorder}
                  renderItem={(rule) => (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {RULE_LABELS[rule.ruleType] || rule.ruleType}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {rule.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleEditRule(rule)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition"
                          title="Редактировать"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => toggleRule(rule.id)}
                          className={`p-2 rounded transition ${
                            rule.enabled
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                          title={rule.enabled ? 'Выключить' : 'Включить'}
                        >
                          {rule.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                          title="Удалить"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                />
              </div>
            )}

            {tab === 'reasons' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 md:mb-4 gap-3">
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
                    Причины для запросов сотрудников
                  </h2>
                  <button
                    onClick={() => {
                      setEditingReason(null);
                      setReasonModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm md:text-base w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden sm:inline">Добавить причину</span>
                    <span className="sm:hidden">Добавить</span>
                  </button>
                </div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-3 md:mb-4">
                  Перетаскивайте причины для изменения приоритета (верхние = выше приоритет)
                </p>
                <DraggableList
                  items={reasons}
                  getId={r => r.id}
                  onReorder={handleReasonsReorder}
                  renderItem={(reason) => (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {reason.color && (
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: reason.color }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{reason.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Приоритет: {reason.priority}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteReason(reason.id)}
                        className="ml-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal for adding/editing validation rules */}
      {ruleModalOpen && (
        <ValidationRuleModal
          rule={editingRule}
          employees={employees}
          onSave={handleSaveRule}
          onClose={() => {
            setRuleModalOpen(false);
            setEditingRule(null);
          }}
        />
      )}

      {/* Modal for adding/editing preference reasons */}
      {reasonModalOpen && (
        <PreferenceReasonModal
          reason={editingReason}
          onSave={handleSaveReason}
          onClose={() => {
            setReasonModalOpen(false);
            setEditingReason(null);
          }}
        />
      )}
    </div>
  );
}
