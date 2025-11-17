import { useState } from 'react';
import { Plus, Edit2, Trash2, Palette } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { Shift } from '../types';

interface ShiftManagerProps {
  shifts: Shift[];
  onAddShift: (shift: Omit<Shift, 'id'>) => void;
  onEditShift: (id: string, shift: Omit<Shift, 'id'>) => void;
  onDeleteShift: (id: string) => void;
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#64748B', '#475569', '#1E293B'
];

export function ShiftManager({ shifts, onAddShift, onEditShift, onDeleteShift }: ShiftManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    abbreviation: '',
    color: '#3B82F6',
    hours: 8,
    startTime: '09:00',
    endTime: '17:00'
  });
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.abbreviation.length <= 2 && formData.hours >= 0) {
      if (editingId) {
        onEditShift(editingId, formData);
        setEditingId(null);
      } else {
        onAddShift(formData);
        setIsAdding(false);
      }
      setFormData({ name: '', abbreviation: '', color: '#3B82F6', hours: 8, startTime: '09:00', endTime: '17:00' });
      setShowColorPicker(false);
    }
  };

  const handleEdit = (shift: Shift) => {
    if (shift.isDefault) {
      alert('Смену "Выходной" нельзя редактировать');
      return;
    }
    setEditingId(shift.id);
    setFormData({
      name: shift.name,
      abbreviation: shift.abbreviation,
      color: shift.color,
      hours: shift.hours,
      startTime: shift.startTime || '09:00',
      endTime: shift.endTime || '17:00'
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', abbreviation: '', color: '#3B82F6', hours: 8, startTime: '09:00', endTime: '17:00' });
    setShowColorPicker(false);
  };

  const handleDelete = (shift: Shift) => {
    if (shift.isDefault) {
      alert('Смену "Выходной" нельзя удалить');
      return;
    }
    onDeleteShift(shift.id);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">Управление сменами</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm md:text-base w-full sm:w-auto"
          >
            <Plus size={18} className="md:w-5 md:h-5" />
            <span className="hidden sm:inline">Добавить смену</span>
            <span className="sm:hidden">Добавить</span>
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-6 p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Название смены</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Например: Дневная"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Аббревиатура (макс. 2 символа)</label>
              <input
                type="text"
                value={formData.abbreviation}
                onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value.slice(0, 2).toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                placeholder="Д"
                maxLength={2}
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Цвет смены</label>

            {/* Color Preview and Picker Toggle */}
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="flex items-center gap-2 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors bg-white dark:bg-gray-800"
              >
                <div
                  className="w-8 h-8 rounded-md border-2 border-white shadow-sm"
                  style={{ backgroundColor: formData.color }}
                />
                <Palette size={20} className="text-gray-600 dark:text-gray-400" />
                <span className="font-mono text-sm text-gray-900 dark:text-gray-100">{formData.color.toUpperCase()}</span>
              </button>

              {/* Preview badge */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-400">Предпросмотр:</span>
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                  style={{ backgroundColor: formData.color }}
                >
                  {formData.abbreviation || '?'}
                </div>
              </div>
            </div>

            {/* Preset Colors */}
            <div className="mb-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Готовые цвета:</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-8 h-8 rounded-md border-2 transition-all hover:scale-110 ${
                      formData.color === color ? 'border-gray-800 dark:border-gray-300 ring-2 ring-blue-500 dark:ring-blue-400' : 'border-white dark:border-gray-700'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Color Picker */}
            {showColorPicker && (
              <div className="mt-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                <HexColorPicker color={formData.color} onChange={(color) => setFormData({ ...formData, color })} />
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full mt-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm uppercase"
                  placeholder="#3B82F6"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Время начала</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Время окончания</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Количество часов</label>
              <input
                type="number"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="8"
                min="0"
                max="24"
                required
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Установите время начала и окончания смены, а также количество рабочих часов</p>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition-colors text-sm md:text-base"
            >
              {editingId ? 'Сохранить изменения' : 'Добавить смену'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors text-sm md:text-base"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800 gap-3 sm:gap-0"
          >
            <div className="flex items-center gap-2 md:gap-3 flex-1">
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-lg flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-sm flex-shrink-0"
                style={{ backgroundColor: shift.color }}
              >
                {shift.abbreviation}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                  <p className="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200 truncate">{shift.name}</p>
                  {shift.isDefault && (
                    <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 md:px-2 py-0.5 rounded whitespace-nowrap">По умолчанию</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{shift.color.toUpperCase()}</p>
                {shift.startTime && shift.endTime && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {shift.startTime} - {shift.endTime}
                  </p>
                )}
                <p className="text-xs md:text-sm font-semibold text-blue-600 dark:text-blue-400 mt-1">{shift.hours} ч</p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleEdit(shift)}
                disabled={shift.isDefault}
                className={`p-2 rounded-lg transition-colors ${
                  shift.isDefault
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                }`}
                title={shift.isDefault ? 'Нельзя редактировать' : 'Редактировать'}
              >
                <Edit2 size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
              <button
                onClick={() => handleDelete(shift)}
                disabled={shift.isDefault}
                className={`p-2 rounded-lg transition-colors ${
                  shift.isDefault
                    ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                }`}
                title={shift.isDefault ? 'Нельзя удалить' : 'Удалить'}
              >
                <Trash2 size={16} className="md:w-[18px] md:h-[18px]" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {shifts.length === 0 && !isAdding && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Нет созданных смен. Нажмите "Добавить смену" для создания.
        </div>
      )}
    </div>
  );
}
