import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users } from 'lucide-react';
import { Employee, Role } from '../types';
import { employeeApi, roleApi } from '../services/api';

export default function EmployeeManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    roleId: undefined as number | undefined,
    excludeFromHours: false,
  });

  const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Загрузка данных
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [employeesData, rolesData] = await Promise.all([
        employeeApi.getAll(),
        roleApi.getAll(),
      ]);
      setEmployees(employeesData);
      setRoles(rolesData);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки данных');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      return;
    }

    try {
      if (editingId) {
        await employeeApi.update(editingId, {
          name: formData.name,
          roleId: formData.roleId,
          excludeFromHours: formData.excludeFromHours,
        });
      } else {
        await employeeApi.create({
          id: generateId(),
          name: formData.name,
          roleId: formData.roleId,
          excludeFromHours: formData.excludeFromHours,
        });
      }
      await loadData();
      handleCancel();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения сотрудника');
      console.error('Error saving employee:', err);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setFormData({
      name: employee.name,
      roleId: employee.roleId,
      excludeFromHours: employee.excludeFromHours || false,
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить этого сотрудника? Все его назначения в графике будут удалены.')) {
      return;
    }

    try {
      await employeeApi.delete(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления сотрудника');
      console.error('Error deleting employee:', err);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      roleId: undefined,
      excludeFromHours: false,
    });
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <p className="text-gray-600 dark:text-gray-400">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
          <h2 className="text-lg md:text-xl font-bold text-gray-800 dark:text-gray-100">Управление сотрудниками</h2>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm md:text-base w-full sm:w-auto"
          >
            <Plus size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">Добавить сотрудника</span>
            <span className="sm:hidden">Добавить</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <div className="space-y-4">
            {/* Имя сотрудника */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Имя сотрудника *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Введите имя"
                required
                autoFocus
              />
            </div>

            {/* Роль */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Роль
              </label>
              <select
                value={formData.roleId || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  roleId: e.target.value ? parseInt(e.target.value) : undefined
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">Без роли</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {roles.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Нет доступных ролей. Создайте роли в настройках.
                </p>
              )}
            </div>

            {/* Не считать часы */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.excludeFromHours}
                  onChange={(e) => setFormData({ ...formData, excludeFromHours: e.target.checked })}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Не считать часы (часы этого сотрудника не учитываются в общей статистике)
                </span>
              </label>
            </div>

            {/* Кнопки */}
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                {editingId ? 'Сохранить' : 'Добавить'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Список сотрудников */}
      <div className="space-y-2">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow gap-3 sm:gap-0"
          >
            <div className="flex items-start gap-2 md:gap-3 flex-1 w-full sm:w-auto">
              {employee.role && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: employee.role.color }}
                  title={employee.role.name}
                >
                  {employee.role.name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                  <span className="font-medium text-sm md:text-base text-gray-800 dark:text-gray-200 truncate">{employee.name}</span>
                  {employee.role && (
                    <span
                      className="text-xs px-1.5 md:px-2 py-0.5 rounded font-medium whitespace-nowrap"
                      style={{
                        backgroundColor: `${employee.role.color}20`,
                        color: employee.role.color,
                      }}
                    >
                      {employee.role.name}
                    </span>
                  )}
                  {employee.excludeFromHours && (
                    <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 md:px-2 py-0.5 rounded font-medium whitespace-nowrap">
                      Не учитывать часы
                    </span>
                  )}
                </div>
                {employee.role?.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">{employee.role.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleEdit(employee)}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                title="Редактировать"
              >
                <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
              <button
                onClick={() => handleDelete(employee.id)}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                title="Удалить"
              >
                <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {employees.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Нет добавленных сотрудников. Нажмите "Добавить сотрудника" для создания.
        </div>
      )}
    </div>
  );
}
