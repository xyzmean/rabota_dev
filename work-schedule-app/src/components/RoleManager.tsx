import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Shield } from 'lucide-react';
import { Role, RolePermissions } from '../types';
import { roleApi } from '../services/api';
import { HexColorPicker } from 'react-colorful';

interface PermissionItem {
  key: keyof RolePermissions;
  label: string;
  description: string;
}

const AVAILABLE_PERMISSIONS: PermissionItem[] = [
  { key: 'manage_schedule', label: 'Управление графиком', description: 'Создание и редактирование графика работы' },
  { key: 'manage_employees', label: 'Управление сотрудниками', description: 'Добавление, редактирование и удаление сотрудников' },
  { key: 'manage_shifts', label: 'Управление сменами', description: 'Создание и настройка смен' },
  { key: 'manage_settings', label: 'Управление настройками', description: 'Изменение глобальных настроек приложения' },
  { key: 'view_statistics', label: 'Просмотр статистики', description: 'Доступ к статистике и отчетам' },
  { key: 'approve_preferences', label: 'Одобрение запросов', description: 'Рассмотрение и одобрение запросов сотрудников' },
  { key: 'manage_roles', label: 'Управление ролями', description: 'Создание и редактирование ролей и прав' },
  { key: 'manage_validation_rules', label: 'Управление правилами', description: 'Настройка правил валидации графика' },
];

export default function RoleManager() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    color: '#6b7280',
    description: '',
    permissions: {} as RolePermissions,
  });

  // Загрузка ролей
  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await roleApi.getAll();
      setRoles(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки ролей');
      console.error('Error loading roles:', err);
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
      if (editingId !== null) {
        await roleApi.update(editingId, formData);
      } else {
        await roleApi.create(formData);
      }
      await loadRoles();
      handleCancel();
    } catch (err: any) {
      setError(err.message || 'Ошибка сохранения роли');
      console.error('Error saving role:', err);
    }
  };

  const handleEdit = (role: Role) => {
    setEditingId(role.id);
    setFormData({
      name: role.name,
      color: role.color || '#6b7280',
      description: role.description || '',
      permissions: role.permissions || {},
    });
    setIsAdding(true);
  };

  const handleDelete = async (id: number, isSystem?: boolean) => {
    if (isSystem) {
      alert('Системные роли нельзя удалять');
      return;
    }

    if (!confirm('Удалить эту роль?')) {
      return;
    }

    try {
      await roleApi.delete(id);
      await loadRoles();
    } catch (err: any) {
      setError(err.message || 'Ошибка удаления роли');
      console.error('Error deleting role:', err);
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      name: '',
      color: '#6b7280',
      description: '',
      permissions: {},
    });
    setShowColorPicker(false);
  };

  const togglePermission = (key: keyof RolePermissions) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [key]: !formData.permissions[key],
      },
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Управление ролями</h2>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
          >
            <Plus size={20} />
            Добавить роль
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
          {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
          <div className="space-y-4">
            {/* Название роли */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Название роли *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Например: Старший смены"
                required
                autoFocus
                disabled={editingId !== null && roles.find(r => r.id === editingId)?.isSystem}
              />
            </div>

            {/* Цвет */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Цвет роли
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                  style={{ backgroundColor: formData.color }}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="#6b7280"
                  disabled={editingId !== null && roles.find(r => r.id === editingId)?.isSystem}
                />
              </div>
              {showColorPicker && (
                <div className="mt-2">
                  <HexColorPicker color={formData.color} onChange={(color) => setFormData({ ...formData, color })} />
                </div>
              )}
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Описание
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Краткое описание роли"
                rows={2}
              />
            </div>

            {/* Права доступа */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Права доступа
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {AVAILABLE_PERMISSIONS.map((permission) => (
                  <label
                    key={permission.key}
                    className="flex items-start gap-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formData.permissions[permission.key] || false}
                      onChange={() => togglePermission(permission.key)}
                      className="mt-1 w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{permission.label}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{permission.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Кнопки */}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              >
                {editingId !== null ? 'Сохранить' : 'Добавить'}
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

      {/* Список ролей */}
      <div className="space-y-2">
        {roles.map((role) => (
          <div
            key={role.id}
            className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: role.color }}
              >
                <Shield size={16} className="text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{role.name}</span>
                  {role.isSystem && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium">
                      Системная
                    </span>
                  )}
                </div>
                {role.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{role.description}</p>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Прав: {Object.values(role.permissions).filter(Boolean).length} из {AVAILABLE_PERMISSIONS.length}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(role)}
                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                title="Редактировать"
              >
                <Edit2 size={18} />
              </button>
              <button
                onClick={() => handleDelete(role.id, role.isSystem)}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={role.isSystem ? 'Системную роль нельзя удалить' : 'Удалить'}
                disabled={role.isSystem}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {roles.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Нет добавленных ролей. Нажмите "Добавить роль" для создания.
        </div>
      )}
    </div>
  );
}
