import { useState, useEffect } from 'react';
import {
  Play,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Loader2,
  X,
  Info,
  Zap,
  Target,
  Users
} from 'lucide-react';
import { autoScheduleApi, AutoScheduleGenerationOptions, AutoScheduleResult, RuleViolation, ScheduleMetrics, OptimizationSuggestion } from '../services/api';

interface AutoSchedManagerProps {
  month: number;
  year: number;
  employees: any[];
  shifts: any[];
  onScheduleGenerated: (result: AutoScheduleResult) => void;
  onValidationComplete?: (violations: RuleViolation[], metrics: ScheduleMetrics) => void;
}

export function AutoSchedManager({
  month,
  year,
  employees,
  shifts,
  onScheduleGenerated,
  onValidationComplete
}: AutoSchedManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [generationResult, setGenerationResult] = useState<AutoScheduleResult | null>(null);
  const [currentViolations, setCurrentViolations] = useState<RuleViolation[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<ScheduleMetrics | null>(null);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [generationTime, setGenerationTime] = useState<number>(0);

  // Generation options
  const [options, setOptions] = useState<AutoScheduleGenerationOptions>({
    month,
    year,
    options: {
      algorithm: 'hybrid',
      optimizationFocus: 'balance',
      maxIterations: 100,
      timeoutMs: 30000
    }
  });

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Update month/year when props change
  useEffect(() => {
    setOptions(prev => ({
      ...prev,
      month,
      year
    }));
  }, [month, year]);

  const handleGenerateSchedule = async () => {
    if (employees.length === 0) {
      alert('Сначала добавьте сотрудников');
      return;
    }

    if (shifts.filter(s => s.id !== 'Выходной').length === 0) {
      alert('Сначала создайте хотя бы одну рабочую смену');
      return;
    }

    setIsGenerating(true);
    setGenerationResult(null);
    setShowResults(false);

    try {
      const startTime = Date.now();
      const result = await autoScheduleApi.generateSchedule(options);
      const endTime = Date.now();

      setGenerationTime(endTime - startTime);
      setGenerationResult(result);
      setCurrentViolations(result.violations);
      setCurrentMetrics(result.metrics);
      setShowResults(true);

      onScheduleGenerated(result);

      if (onValidationComplete) {
        onValidationComplete(result.violations, result.metrics);
      }

    } catch (error: any) {
      console.error('Failed to generate schedule:', error);
      alert(`Ошибка при генерации графика: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleValidateSchedule = async () => {
    setIsValidating(true);
    try {
      const result = await autoScheduleApi.validateSchedule(month, year);
      setCurrentViolations([...result.violations, ...result.warnings]);
      setCurrentMetrics(result.metrics);

      if (onValidationComplete) {
        onValidationComplete([...result.violations, ...result.warnings], result.metrics);
      }

    } catch (error: any) {
      console.error('Failed to validate schedule:', error);
      alert(`Ошибка при валидации графика: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleGetSuggestions = async () => {
    try {
      const result = await autoScheduleApi.suggestImprovements(month, year, ['balance', 'preferences', 'coverage']);
      setSuggestions(result.suggestions);
    } catch (error: any) {
      console.error('Failed to get suggestions:', error);
      alert(`Ошибка при получении предложений: ${error.message || 'Неизвестная ошибка'}`);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}мс`;
    return `${(ms / 1000).toFixed(2)}с`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            AutoSched
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Интеллектуальная генерация графика для {monthNames[month]} {year}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
            title="Настройки генерации"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Настройки</span>
          </button>

          <button
            onClick={handleValidateSchedule}
            disabled={isValidating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {isValidating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Проверить</span>
          </button>

          <button
            onClick={handleGenerateSchedule}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Сгенерировать</span>
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Настройки генерации</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Алгоритм
              </label>
              <select
                value={options.options?.algorithm || 'hybrid'}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  options: { ...prev.options, algorithm: e.target.value as any }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="greedy">Жадный алгоритм</option>
                <option value="constraint">Метод ограничений</option>
                <option value="hybrid">Гибридный (рекомендуется)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Приоритет оптимизации
              </label>
              <select
                value={options.options?.optimizationFocus || 'balance'}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  options: { ...prev.options, optimizationFocus: e.target.value as any }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="coverage">Покрытие смен</option>
                <option value="balance">Балансировка нагрузки</option>
                <option value="preferences">Учет предпочтений</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Макс. итераций
              </label>
              <input
                type="number"
                value={options.options?.maxIterations || 100}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  options: { ...prev.options, maxIterations: parseInt(e.target.value) || 100 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                min="1"
                max="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Таймаут (мс)
              </label>
              <input
                type="number"
                value={options.options?.timeoutMs || 30000}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  options: { ...prev.options, timeoutMs: parseInt(e.target.value) || 30000 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                min="5000"
                max="300000"
                step="5000"
              />
            </div>
          </div>
        </div>
      )}

      {/* Current Status */}
      {(currentViolations.length > 0 || currentMetrics) && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Текущий статус
          </h3>

          {currentMetrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(currentMetrics.coveragePercentage)}`}>
                  {currentMetrics.coveragePercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Покрытие</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(currentMetrics.balanceScore)}`}>
                  {currentMetrics.balanceScore.toFixed(1)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Баланс</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(currentMetrics.preferenceSatisfactionRate)}`}>
                  {currentMetrics.preferenceSatisfactionRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Предпочтения</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${getScoreColor(100 - (currentMetrics.violationCount * 10))}`}>
                  {currentMetrics.totalShifts}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Смены</div>
              </div>
            </div>
          )}

          {currentViolations.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Нарушения правил ({currentViolations.length})
                </h4>
                <button
                  onClick={handleGetSuggestions}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  Получить предложения
                </button>
              </div>

              <div className="space-y-1 max-h-32 overflow-y-auto">
                {currentViolations.slice(0, 10).map((violation, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 text-xs p-2 bg-gray-50 dark:bg-gray-700 rounded"
                  >
                    {getSeverityIcon(violation.severity)}
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {violation.message}
                    </span>
                  </div>
                ))}
                {currentViolations.length > 10 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    ... и еще {currentViolations.length - 10} нарушений
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Предложения по оптимизации
          </h3>

          <div className="space-y-2">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-800">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {suggestion.type}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {suggestion.description}
                  </div>
                </div>
                <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  +{suggestion.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation Results */}
      {showResults && generationResult && (
        <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Результаты генерации
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(generationTime)}
              </span>
              <span>ID: {generationResult.generationId}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className={`text-2xl font-bold ${generationResult.success ? 'text-green-600' : 'text-yellow-600'}`}>
                {generationResult.success ? '✓' : '⚠'}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Статус</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {generationResult.schedule.length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Сгенерировано смен</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {generationResult.metrics.errorCount}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Ошибок</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {generationResult.metrics.warningCount}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Предупреждений</div>
            </div>
          </div>

          {generationResult.message && (
            <div className="text-sm text-gray-700 dark:text-gray-300 p-3 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-800">
              {generationResult.message}
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {employees.length} сотрудников
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {shifts.filter(s => s.id !== 'Выходной').length} смен
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Target className="w-3 h-3" />
            Алгоритм: {options.options?.algorithm || 'hybrid'}
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Фокус: {options.options?.optimizationFocus || 'balance'}
          </span>
        </div>
      </div>
    </div>
  );
}