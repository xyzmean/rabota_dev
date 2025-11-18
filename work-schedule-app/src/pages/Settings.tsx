import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Database, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import DraggableList from '../components/DraggableList';
import { ShiftManager } from '../components/ShiftManager';
import { PreferenceReasonModal } from '../components/PreferenceReasonModal';
import ValidationRulesManager from '../ValidationRulesManager';
import { preferenceReasonsApi, settingsApi, shiftsApi, databaseApi } from '../services/api';
import type { PreferenceReason, Shift } from '../types';

type Tab = 'general' | 'shifts' | 'reasons' | 'validation' | 'database';


export default function Settings() {
  const [tab, setTab] = useState<Tab>('general');
  const [reasons, setReasons] = useState<PreferenceReason[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [businessHoursStart, setBusinessHoursStart] = useState('08:00');
  const [businessHoursEnd, setBusinessHoursEnd] = useState('22:00');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<PreferenceReason | null>(null);
  const [dbStats, setDbStats] = useState<any>(null);
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [validationRulesOpen, setValidationRulesOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tab === 'database') {
      loadDbStats();
    }
  }, [tab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [reasonsData, shiftsData, businessHoursData] = await Promise.all([
        preferenceReasonsApi.getAll(),
        shiftsApi.getAll(),
        settingsApi.getBulk(['business_hours_start', 'business_hours_end']),
      ]);
      setReasons(reasonsData);
      setShifts(shiftsData);

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

  const loadDbStats = async () => {
    try {
      const stats = await databaseApi.getStats();
      if (stats.success) {
        setDbStats(stats.stats);
      }
    } catch (error) {
      console.error('Failed to load database stats:', error);
    }
  };

  const handleClearDatabase = async () => {
    const confirmMessage = `⚠️ ВНИМАНИЕ! Это действие удалит ВСЕ данные из базы данных:\n\n` +
      `• Все сотрудники: ${dbStats?.employees || 0}\n` +
      `• Все смены: ${dbStats?.shifts || 0}\n` +
      `• Весь график: ${dbStats?.schedule || 0} записей\n` +
      `• Все причины запросов: ${dbStats?.preferenceReasons || 0}\n` +
      `• Все запросы сотрудников: ${dbStats?.employeePreferences || 0}\n` +
      `• Все настройки: ${dbStats?.appSettings || 0}\n\n` +
      `Восстановить данные будет невозможно!\n\n` +
      `Для подтверждения введите: УДАЛИТЬ ВСЕ ДАННЫЕ`;

    const confirmation = prompt(confirmMessage);

    if (confirmation !== 'УДАЛИТЬ ВСЕ ДАННЫЕ') {
      alert('Операция отменена.');
      return;
    }

    setIsClearingDb(true);
    try {
      const result = await databaseApi.clearDatabase();
      if (result.success) {
        alert(`База данных успешно очищена!\n\n${result.message}\n\nОчищенные таблицы:\n${result.clearedTables.join(', ')}`);
        // Перезагружаем статистику
        await loadDbStats();
        // Перезагружаем все данные
        await loadData();
      }
    } catch (error) {
      console.error('Failed to clear database:', error);
      alert('Произошла ошибка при очистке базы данных. Пожалуйста, проверьте консоль для деталей.');
    } finally {
      setIsClearingDb(false);
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
            { id: 'reasons', label: 'Причины запросов' },
            { id: 'validation', label: 'Правила валидации' },
            { id: 'database', label: 'База данных' },
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

            {tab === 'validation' && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 md:mb-4 gap-3">
                  <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
                    Правила валидации графика
                  </h2>
                  <button
                    onClick={() => setValidationRulesOpen(true)}
                    className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm md:text-base w-full sm:w-auto"
                  >
                    <SettingsIcon className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="hidden sm:inline">Управлять правилами</span>
                    <span className="sm:hidden">Правила</span>
                  </button>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5" />
                    Что такое правила валидации?
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                    Правила валидации автоматически проверяют график на соответствие заданным ограничениям и требованиям.
                    Они помогают поддерживать качество графика и предотвращать ошибки при планировании.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded p-3 border border-blue-200 dark:border-blue-700">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">⚠️ Предупреждения</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Нежелательные, но допустимые ситуации (например, переработка)
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-3 border border-red-200 dark:border-red-700">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">❌ Ошибки</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Критические нарушения, которые должны быть исправлены (например, нехватка персонала)
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    💡 <strong>Совет:</strong> Нажмите "Управлять правилами", чтобы создать, редактировать или настроить правила валидации под ваши нужды.
                  </p>
                </div>
              </div>
            )}

            {tab === 'database' && (
              <div className="space-y-4 md:space-y-6">
                {/* Database Statistics */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">
                      Статистика базы данных
                    </h2>
                  </div>

                  {dbStats ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
                          {dbStats.employees || 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Сотрудники</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-400">
                          {dbStats.shifts || 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Смены</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400">
                          {dbStats.schedule || 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Записи графика</div>
                      </div>
                                            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl md:text-3xl font-bold text-pink-600 dark:text-pink-400">
                          {dbStats.preferenceReasons || 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Причины запросов</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl md:text-3xl font-bold text-teal-600 dark:text-teal-400">
                          {dbStats.employeePreferences || 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Запросы сотрудников</div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 md:p-4">
                        <div className="text-2xl md:text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                          {dbStats.appSettings || 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Настройки</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      Загрузка статистики...
                    </div>
                  )}
                </div>

                {/* Database Operations */}
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 md:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    <h2 className="text-lg md:text-xl font-bold text-red-900 dark:text-red-100">
                      Опасные операции
                    </h2>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-4">
                      <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                        Полная очистка базы данных
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                        ⚠️ <strong>Критически важное предупреждение:</strong> Эта действие безвозвратно удалит ВСЕ данные из базы данных:
                        сотрудников, смены, график, правила, настройки и т.д. Структура базы данных сохранится.
                      </p>
                      <button
                        onClick={handleClearDatabase}
                        disabled={isClearingDb}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors font-medium disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isClearingDb ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Очистка...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Очистить всю базу данных
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      
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

      {/* Validation Rules Modal */}
      <ValidationRulesManager
        isOpen={validationRulesOpen}
        onClose={() => setValidationRulesOpen(false)}
      />
    </div>
  );
}
