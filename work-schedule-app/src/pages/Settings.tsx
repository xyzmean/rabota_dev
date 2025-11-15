import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import DraggableList from '../components/DraggableList';
import { validationRulesApi, preferenceReasonsApi } from '../services/api';
import type { ValidationRule, PreferenceReason } from '../types';

type Tab = 'general' | 'rules' | 'reasons';

const RULE_LABELS: Record<string, string> = {
  max_consecutive_shifts: 'Максимальное кол-во смен подряд',
  min_employees_per_shift: 'Минимум сотрудников в смене',
  max_employees_per_shift: 'Максимум сотрудников в смене',
  max_employees_per_shift_type: 'Максимум людей в конкретной смене',
  required_coverage: 'Обязательное покрытие часов/дней',
  manager_requirements: 'Требования к УМ/ЗУМ',
  max_total_hours: 'Максимум часов в месяц (все)',
  max_hours_without_managers: 'Максимум часов (без УМ/ЗУМ)',
};

export default function Settings() {
  const [tab, setTab] = useState<Tab>('general');
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [reasons, setReasons] = useState<PreferenceReason[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, reasonsData] = await Promise.all([
        validationRulesApi.getAll(),
        preferenceReasonsApi.getAll(),
      ]);
      setRules(rulesData);
      setReasons(reasonsData);
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 text-white p-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:bg-white/10 p-2 rounded-lg transition">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-bold">Настройки</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex gap-2 mb-6 border-b border-gray-300 dark:border-gray-700">
          {[
            { id: 'general', label: 'Общие' },
            { id: 'rules', label: 'Правила валидации' },
            { id: 'reasons', label: 'Причины запросов' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`px-4 py-2 font-medium transition ${
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
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">Основные настройки</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Тема оформления</label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Используйте переключатель в шапке для смены темы</p>
                  </div>
                </div>
              </div>
            )}

            {tab === 'rules' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  Правила валидации графика
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Перетаскивайте правила для изменения приоритета (верхние = выше приоритет)
                </p>
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
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className={`ml-4 p-2 rounded transition ${
                          rule.enabled
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {rule.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                    </div>
                  )}
                />
              </div>
            )}

            {tab === 'reasons' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  Причины для запросов сотрудников
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
    </div>
  );
}
