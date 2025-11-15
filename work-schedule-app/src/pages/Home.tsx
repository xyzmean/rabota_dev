import { Link } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12 relative">
            <div className="absolute top-0 right-0 flex gap-2">
              <ThemeToggle />
              <Link
                to="/settings"
                className="p-2 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors"
                title="Настройки"
              >
                <SettingsIcon className="w-5 h-5 text-gray-800 dark:text-gray-200" />
              </Link>
            </div>
            <h1 className="text-5xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              RaboTA
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Внутренний сайт для управления рабочими процессами
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Schedule Card */}
            <Link
              to="/schedule"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300 border-2 border-transparent hover:border-indigo-500"
            >
              <div className="flex items-center mb-4">
                <div className="bg-indigo-100 p-3 rounded-lg">
                  <svg
                    className="w-8 h-8 text-indigo-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 ml-4">
                  График работы
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-300">
                Управление сотрудниками, создание смен и планирование графика работы
              </p>
            </Link>

            {/* Placeholder for future features */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 opacity-50 cursor-not-allowed">
              <div className="flex items-center mb-4">
                <div className="bg-gray-100 p-3 rounded-lg">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-400 ml-4">
                  Скоро
                </h2>
              </div>
              <p className="text-gray-400">
                Дополнительный функционал будет добавлен позже
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Возможности
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center text-gray-700 dark:text-gray-300">
                <svg
                  className="w-5 h-5 text-green-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Управление сотрудниками и сменами
              </li>
              <li className="flex items-center text-gray-700">
                <svg
                  className="w-5 h-5 text-green-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Визуальный календарь с назначением смен
              </li>
              <li className="flex items-center text-gray-700">
                <svg
                  className="w-5 h-5 text-green-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Автоматическое сохранение данных в браузере
              </li>
              <li className="flex items-center text-gray-400">
                <svg
                  className="w-5 h-5 text-gray-300 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Дополнительные инструменты (в разработке)
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
