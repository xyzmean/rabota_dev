import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, Settings as SettingsIcon, PlusCircle, Calendar, User, MessageSquare, CheckCircle, XCircle, Clock, Edit2, Trash2 } from 'lucide-react';
import { DayOffRequestModal } from '../components/DayOffRequestModal';
import { DayOffRequestViewer } from '../components/DayOffRequestViewer';
import { employeeApi, preferenceReasonsApi, preferencesApi, validationRulesApi } from '../services/api';
import { Employee, PreferenceReason, EmployeePreference, EmployeePreferenceInput } from '../types';

export default function DayOffRequests() {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<EmployeePreference | null>(null);
  const [editingRequest, setEditingRequest] = useState<EmployeePreference | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reasons, setReasons] = useState<PreferenceReason[]>([]);
  const [preferences, setPreferences] = useState<EmployeePreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesData, reasonsData, preferencesData] = await Promise.all([
        employeeApi.getAll(),
        preferenceReasonsApi.getAll(),
        preferencesApi.getAll(),
      ]);
      setEmployees(employeesData);
      setReasons(reasonsData);
      setPreferences(preferencesData);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (id: number) => {
    try {
      // Найдем запрос для получения информации
      const request = preferences.find(p => p.id === id);
      if (!request) return;

      // Обновим статус запроса
      await preferencesApi.updateStatus(id, 'approved');

      // Создадим правило валидации для подтвержденного выходного
      const employee = employees.find(e => e.id === request.employeeId);
      if (employee) {
        const ruleData = {
          ruleType: 'employee_day_off' as const,
          enabled: true,
          config: {
            employeeId: request.employeeId,
            specificDate: request.targetDate, // YYYY-MM-DD format
          },
          appliesToEmployees: [request.employeeId],
          enforcementType: 'error' as const,
          customMessage: `Выходной для ${employee.name} (${request.targetDate})`,
          priority: 1, // Высший приоритет
          description: `Автоматически созданное правило для выходного дня сотрудника ${employee.name}`
        };

        // Создаем правило с высшим приоритетом
        const newRule = await validationRulesApi.create(ruleData);

        // Обновим приоритеты всех существующих правил
        try {
          const existingRules = await validationRulesApi.getAll();
          const rulesToUpdate = existingRules
            .filter(r => r.id !== newRule.id)
            .sort((a, b) => a.priority - b.priority)
            .map((rule, index) => ({
              ...rule,
              priority: index + 2 // Новые приоритеты: 2, 3, 4, ...
            }));

          // Обновляем приоритеты
          for (const rule of rulesToUpdate) {
            await validationRulesApi.update(rule.id, {
              ...rule,
              priority: rule.priority
            });
          }
        } catch (priorityError) {
          console.warn('Failed to update rule priorities:', priorityError);
        }
      }

      await loadData();
    } catch (err) {
      console.error('Failed to approve request:', err);
      alert('Ошибка при одобрении запроса');
    }
  };

  const handleRejectRequest = async (id: number) => {
    try {
      await preferencesApi.updateStatus(id, 'rejected');
      await loadData();
    } catch (err) {
      console.error('Failed to reject request:', err);
      alert('Ошибка при отклонении запроса');
    }
  };

  const handleDeleteRequest = async (id: number) => {
    if (!confirm('Удалить этот запрос?')) return;
    try {
      await preferencesApi.delete(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete request:', err);
      alert('Ошибка при удалении запроса');
    }
  };

  const handleViewRequestDetails = (preference: EmployeePreference) => {
    setViewingRequest(preference);
  };

  const handleEditRequest = (preference: EmployeePreference) => {
    setEditingRequest(preference);
    setRequestModalOpen(true);
  };

  const handleUpdateRequest = async (request: EmployeePreferenceInput) => {
    try {
      if (editingRequest) {
        await preferencesApi.update(editingRequest.id, request);
        await loadData();
        alert('Запрос успешно обновлен!');
      } else {
        await preferencesApi.create(request);
        await loadData();
        alert('Запрос на выходной успешно создан!');
      }
      setEditingRequest(null);
      setRequestModalOpen(false);
    } catch (err) {
      console.error('Failed to save request:', err);
      alert('Ошибка при сохранении запроса');
    }
  };

  const filteredPreferences = preferences.filter(pref => {
    if (filter === 'all') return true;
    return pref.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium">
            <Clock size={12} />
            Ожидает
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
            <CheckCircle size={12} />
            Одобрено
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium">
            <XCircle size={12} />
            Отклонено
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getEmployeeName = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee?.name || 'Неизвестный сотрудник';
  };

  const getReasonName = (reasonId?: number) => {
    if (!reasonId) return 'Не указана';
    const reason = reasons.find(r => r.id === reasonId);
    return reason?.name || 'Не указана';
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Запросы на выходные</h1>
              <p className="text-green-100 dark:text-green-200 mt-1 text-sm md:text-base">Управление запросами сотрудников на выходные дни</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <Link
                to="/settings"
                className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg transition-colors text-sm md:text-base"
                title="Настройки"
              >
                <SettingsIcon size={18} className="md:w-5 md:h-5" />
                <span className="hidden sm:inline">Настройки</span>
              </Link>
              <Link
                to="/"
                className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white/10 hover:bg-white/20 dark:bg-white/10 dark:hover:bg-white/20 rounded-lg transition-colors text-sm md:text-base"
              >
                <Home size={18} className="md:w-5 md:h-5" />
                <span className="hidden sm:inline">Главная</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Action Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <button
              onClick={() => {
                setEditingRequest(null);
                setRequestModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors text-sm md:text-base shadow-md hover:shadow-lg"
            >
              <PlusCircle size={20} />
              Создать запрос
            </button>

            {/* Filter Buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Все ({preferences.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'pending'
                    ? 'bg-yellow-500 dark:bg-yellow-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Ожидают ({preferences.filter(p => p.status === 'pending').length})
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'approved'
                    ? 'bg-green-500 dark:bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Одобрено ({preferences.filter(p => p.status === 'approved').length})
              </button>
              <button
                onClick={() => setFilter('rejected')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'rejected'
                    ? 'bg-red-500 dark:bg-red-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Отклонено ({preferences.filter(p => p.status === 'rejected').length})
              </button>
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
          {loading ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              Загрузка запросов...
            </div>
          ) : filteredPreferences.length === 0 ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              {filter === 'all' ? 'Запросы на выходные отсутствуют' : `Нет запросов со статусом "${filter}"`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Сотрудник
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Дата
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Причина
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredPreferences.map((pref) => (
                    <tr
                      key={pref.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={() => handleViewRequestDetails(pref)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User size={16} className="text-gray-400 dark:text-gray-500" />
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {getEmployeeName(pref.employeeId)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} className="text-gray-400 dark:text-gray-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {pref.targetDate ? formatDate(pref.targetDate) : 'Не указана'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <MessageSquare size={16} className="text-gray-400 dark:text-gray-500" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {getReasonName(pref.reasonId)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(pref.status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1">
                          {/* Кнопка просмотра деталей */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewRequestDetails(pref);
                            }}
                            className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                            title="Подробнее"
                          >
                            <MessageSquare size={16} />
                          </button>

                          {/* Кнопки редактирования и удаления для ожидающих запросов */}
                          {pref.status === 'pending' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditRequest(pref);
                                }}
                                className="p-1.5 rounded bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400 transition-colors"
                                title="Редактировать"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveRequest(pref.id!);
                                }}
                                className="p-1.5 rounded bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 transition-colors"
                                title="Одобрить"
                              >
                                <CheckCircle size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectRequest(pref.id!);
                                }}
                                className="p-1.5 rounded bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                                title="Отклонить"
                              >
                                <XCircle size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRequest(pref.id!);
                                }}
                                className="p-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 transition-colors"
                                title="Удалить"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}

                          {/* Кнопка удаления для обработанных запросов */}
                          {pref.status !== 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRequest(pref.id!);
                              }}
                              className="p-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-8 md:mt-12 py-4 md:py-6 text-center text-gray-600 dark:text-gray-400 text-xs md:text-sm">
        <p>RaboTA © {new Date().getFullYear()} | Система управления графиком работы</p>
      </footer>

      {/* Day Off Request Modal */}
      {requestModalOpen && (
        <DayOffRequestModal
          employees={employees}
          reasons={reasons}
          request={editingRequest}
          onSave={handleUpdateRequest}
          onClose={() => {
            setRequestModalOpen(false);
            setEditingRequest(null);
          }}
        />
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
          canApprove={true}
        />
      )}
    </div>
  );
}
