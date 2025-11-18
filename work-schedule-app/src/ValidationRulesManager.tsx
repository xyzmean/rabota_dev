import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Save, X, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { ValidationRule, ValidationRuleType } from './types';

interface ValidationRulesManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onRulesChange?: (rules: ValidationRule[]) => void;
}

interface RuleTemplate {
  type: ValidationRuleType;
  name: string;
  description: string;
  defaultConfig: Record<string, any>;
  parameterFields: Array<{
    name: string;
    label: string;
    type: 'number' | 'text' | 'select';
    defaultValue?: any;
    options?: Array<{ value: any; label: string }>;
  }>;
}

const ruleTemplates: RuleTemplate[] = [
  {
    type: 'min_employees_per_shift',
    name: 'Минимум сотрудников на смене',
    description: 'Минимальное количество сотрудников для каждой смены',
    defaultConfig: { min: 2 },
    parameterFields: [
      {
        name: 'min',
        label: 'Минимум сотрудников',
        type: 'number',
        defaultValue: 2
      }
    ]
  },
  {
    type: 'max_employees_per_shift',
    name: 'Максимум сотрудников на смене',
    description: 'Максимальное количество сотрудников для каждой смены',
    defaultConfig: { max: 5 },
    parameterFields: [
      {
        name: 'max',
        label: 'Максимум сотрудников',
        type: 'number',
        defaultValue: 5
      }
    ]
  },
  {
    type: 'max_consecutive_work_days',
    name: 'Максимум рабочих дней подряд',
    description: 'Максимальное количество рабочих дней подряд для сотрудника',
    defaultConfig: { max_days: 5 },
    parameterFields: [
      {
        name: 'max_days',
        label: 'Максимально дней подряд',
        type: 'number',
        defaultValue: 5
      }
    ]
  },
  {
    type: 'max_hours_per_week',
    name: 'Максимум часов в неделю',
    description: 'Максимальное количество рабочих часов в неделю',
    defaultConfig: { max_hours: 40 },
    parameterFields: [
      {
        name: 'max_hours',
        label: 'Максимум часов в неделю',
        type: 'number',
        defaultValue: 40
      }
    ]
  },
  {
    type: 'max_hours_per_month',
    name: 'Максимум часов в месяц',
    description: 'Максимальное количество рабочих часов в месяц',
    defaultConfig: { max_hours: 160 },
    parameterFields: [
      {
        name: 'max_hours',
        label: 'Максимум часов в месяц',
        type: 'number',
        defaultValue: 160
      }
    ]
  },
  {
    type: 'max_shifts_per_week',
    name: 'Максимум смен в неделю',
    description: 'Максимальное количество смен в неделю для сотрудника',
    defaultConfig: { max: 5 },
    parameterFields: [
      {
        name: 'max',
        label: 'Максимум смен в неделю',
        type: 'number',
        defaultValue: 5
      }
    ]
  },
  {
    type: 'min_rest_between_shifts',
    name: 'Минимальный отдых между сменами',
    description: 'Минимальное количество часов отдыха между сменами',
    defaultConfig: { hours: 12 },
    parameterFields: [
      {
        name: 'hours',
        label: 'Часов отдыха',
        type: 'number',
        defaultValue: 12
      }
    ]
  },
  {
    type: 'required_roles_per_shift',
    name: 'Обязательные роли в смене',
    description: 'Требует наличие определенных ролей в смене',
    defaultConfig: { role: '', min_count: 1 },
    parameterFields: [
      {
        name: 'role',
        label: 'Роль',
        type: 'text',
        defaultValue: ''
      },
      {
        name: 'min_count',
        label: 'Минимум сотрудников с ролью',
        type: 'number',
        defaultValue: 1
      }
    ]
  },
  {
    type: 'approved_day_off_requests',
    name: 'Утвержденные выходные',
    description: 'Соблюдение утвержденных запросов на выходные',
    defaultConfig: {},
    parameterFields: []
  }
];

const ValidationRulesManager: React.FC<ValidationRulesManagerProps> = ({
  isOpen,
  onClose,
  onRulesChange
}) => {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRuleTemplate, setNewRuleTemplate] = useState<RuleTemplate | null>(null);
  const [newRule, setNewRule] = useState<Partial<ValidationRule>>({
    ruleType: 'max_consecutive_work_days',
    enabled: true,
    config: {},
    enforcementType: 'warning',
    priority: 5,
    description: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen]);

  const loadRules = async () => {
    try {
      const response = await fetch('/api/validation-rules');
      const data = await response.json();
      setRules(data.rules || []);
    } catch (error) {
      console.error('Error loading validation rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (rule: ValidationRule) => {
    try {
      const url = editingRule ? `/api/validation-rules/${rule.id}` : '/api/validation-rules';
      const method = editingRule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rule),
      });

      if (response.ok) {
        await loadRules();
        setEditingRule(null);
        setIsCreating(false);
        setNewRuleTemplate(null);
        onRulesChange?.(rules);
      } else {
        console.error('Error saving rule:', await response.text());
      }
    } catch (error) {
      console.error('Error saving rule:', error);
    }
  };

  const deleteRule = async (ruleId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это правило?')) return;

    try {
      const response = await fetch(`/api/validation-rules/${ruleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadRules();
        onRulesChange?.(rules);
      } else {
        console.error('Error deleting rule:', await response.text());
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const toggleRule = async (ruleId: number, enabled: boolean) => {
    try {
      const response = await fetch(`/api/validation-rules/${ruleId}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        await loadRules();
        onRulesChange?.(rules);
      } else {
        console.error('Error toggling rule:', await response.text());
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
    }
  };

  const startCreatingRule = (template: RuleTemplate) => {
    setNewRuleTemplate(template);
    setNewRule({
      ruleType: template.type,
      enabled: true,
      config: template.defaultConfig,
      enforcementType: 'warning',
      priority: 5,
      description: template.description
    });
    setIsCreating(true);
    setEditingRule(null);
  };

  const updateRuleConfig = (key: string, value: any) => {
    if (isCreating && newRule) {
      setNewRule({
        ...newRule,
        config: { ...newRule.config, [key]: value }
      });
    } else if (editingRule) {
      setEditingRule({
        ...editingRule,
        config: { ...editingRule.config, [key]: value }
      });
    }
  };

  const getTemplateName = (ruleType: ValidationRuleType) => {
    const template = ruleTemplates.find(t => t.type === ruleType);
    return template ? template.name : ruleType;
  };

  const getRuleIcon = (enforcementType: string) => {
    return enforcementType === 'error' ?
      <AlertCircle className="w-4 h-4 text-red-500" /> :
      <CheckCircle className="w-4 h-4 text-yellow-500" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Правила валидации графика
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Add New Rule Section */}
            {!isCreating && !editingRule && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Добавить новое правило
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {ruleTemplates.map((template) => (
                    <button
                      key={template.type}
                      onClick={() => startCreatingRule(template)}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                    >
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                        {template.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {template.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create/Edit Rule Form */}
            {(isCreating || editingRule) && (
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {isCreating ? 'Создание правила' : 'Редактирование правила'}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Название правила
                    </label>
                    <input
                      type="text"
                      value={getTemplateName((isCreating ? newRule.ruleType : editingRule?.ruleType) as ValidationRuleType)}
                      disabled
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Описание
                    </label>
                    <input
                      type="text"
                      value={isCreating ? newRule.description || '' : editingRule?.description || ''}
                      onChange={(e) => {
                        if (isCreating) {
                          setNewRule({ ...newRule, description: e.target.value });
                        } else if (editingRule) {
                          setEditingRule({ ...editingRule, description: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Тип применения
                    </label>
                    <select
                      value={isCreating ? newRule.enforcementType : editingRule?.enforcementType}
                      onChange={(e) => {
                        if (isCreating) {
                          setNewRule({ ...newRule, enforcementType: e.target.value as 'error' | 'warning' });
                        } else if (editingRule) {
                          setEditingRule({ ...editingRule, enforcementType: e.target.value as 'error' | 'warning' });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="warning">Предупреждение</option>
                      <option value="error">Ошибка</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Приоритет (1 - самый высокий)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={isCreating ? newRule.priority : editingRule?.priority}
                      onChange={(e) => {
                        if (isCreating) {
                          setNewRule({ ...newRule, priority: parseInt(e.target.value) });
                        } else if (editingRule) {
                          setEditingRule({ ...editingRule, priority: parseInt(e.target.value) });
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Parameters */}
                {(isCreating ? newRuleTemplate : ruleTemplates.find(t => t.type === editingRule?.ruleType))?.parameterFields && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(isCreating ? newRuleTemplate : ruleTemplates.find(t => t.type === editingRule?.ruleType))?.parameterFields.map((field) => (
                      <div key={field.name}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {field.label}
                        </label>
                        {field.type === 'number' ? (
                          <input
                            type="number"
                            value={(isCreating ? (newRule.config || {}) : (editingRule?.config || {}))[field.name] || field.defaultValue || ''}
                            onChange={(e) => updateRuleConfig(field.name, parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        ) : field.type === 'select' ? (
                          <select
                            value={(isCreating ? (newRule.config || {}) : (editingRule?.config || {}))[field.name] || field.defaultValue || ''}
                            onChange={(e) => updateRuleConfig(field.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          >
                            {field.options?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={(isCreating ? (newRule.config || {}) : (editingRule?.config || {}))[field.name] || field.defaultValue || ''}
                            onChange={(e) => updateRuleConfig(field.name, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => {
                      if (isCreating && newRuleTemplate && newRule) {
                        saveRule({
                          id: 0,
                          ruleType: newRule.ruleType as ValidationRuleType,
                          enabled: newRule.enabled || true,
                          config: newRule.config,
                          enforcementType: newRule.enforcementType as 'error' | 'warning',
                          priority: newRule.priority || 5,
                          description: newRule.description || '',
                          appliesToRoles: [],
                          appliesToEmployees: []
                        });
                      } else if (editingRule) {
                        saveRule(editingRule);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setEditingRule(null);
                      setNewRuleTemplate(null);
                      setNewRule({});
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {/* Rules List */}
            {!loading && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Текущие правила
                </h3>
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 border rounded-lg transition-all ${
                        rule.enabled
                          ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getRuleIcon(rule.enforcementType || 'warning')}
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {getTemplateName(rule.ruleType)}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {rule.description || 'Без описания'}
                            </p>
                            <div className="flex gap-4 mt-1">
                              <span className="text-xs text-gray-500">
                                Приоритет: {rule.priority}
                              </span>
                              <span className="text-xs text-gray-500">
                                Тип: {rule.enforcementType === 'error' ? 'Ошибка' : 'Предупреждение'}
                              </span>
                              {rule.config && Object.keys(rule.config).length > 0 && (
                                <span className="text-xs text-gray-500">
                                  Конфиг: {JSON.stringify(rule.config)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleRule(rule.id, !rule.enabled)}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                              rule.enabled
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {rule.enabled ? 'Активно' : 'Неактивно'}
                          </button>
                          <button
                            onClick={() => setEditingRule(rule)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => deleteRule(rule.id)}
                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationRulesManager;