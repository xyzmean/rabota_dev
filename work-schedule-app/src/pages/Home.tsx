import { Link } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import EmployeeManager from '../components/EmployeeManager';
import RoleManager from '../components/RoleManager';

export default function Home() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 md:mb-12">
            {/* Top Controls - Mobile: Stacked, Desktop: Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
              <div className="order-2 sm:order-1 w-full sm:w-auto"></div>
              <div className="order-1 sm:order-2 flex gap-2 w-full sm:w-auto justify-end">
                <ThemeToggle />
                <Link
                  to="/settings"
                  className="p-2 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-colors"
                  title="Настройки"
                >
                  <SettingsIcon className="w-5 h-5 text-gray-800 dark:text-gray-200" />
                </Link>
              </div>
            </div>

            {/* Title */}
            <div className="text-center">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-3 md:mb-4">
                RaboTA
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 px-4">
                Внутренний сайт для управления рабочими процессами
              </p>
            </div>
          </div>

          {/* Управление сотрудниками и ролями */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-12">
            <EmployeeManager />
            <RoleManager />
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-12">
            {/* Schedule Card */}
            <Link
              to="/schedule"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 hover:shadow-xl transition-shadow duration-300 border-2 border-transparent hover:border-indigo-500"
            >
              <div className="flex items-center mb-3 md:mb-4">
                <div className="bg-indigo-100 p-2 md:p-3 rounded-lg">
                  <svg
                    className="w-6 h-6 md:w-8 md:h-8 text-indigo-600"
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
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 ml-3 md:ml-4">
                  График работы
                </h2>
              </div>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-300">
                Управление сотрудниками, создание смен и планирование графика работы
              </p>
            </Link>

            {/* Day Off Requests Card */}
            <Link
              to="/day-off-requests"
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 hover:shadow-xl transition-shadow duration-300 border-2 border-transparent hover:border-green-500"
            >
              <div className="flex items-center mb-3 md:mb-4">
                <div className="bg-green-100 p-2 md:p-3 rounded-lg">
                  <svg
                    className="w-6 h-6 md:w-8 md:h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 ml-3 md:ml-4">
                  Запросы на выходные
                </h2>
              </div>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-300">
                Создание и управление запросами сотрудников на выходные дни
              </p>
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
            <h3 className="text-lg md:text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3 md:mb-4">
              Возможности
            </h3>
            <ul className="space-y-2 md:space-y-3">
              <li className="flex items-start text-sm md:text-base text-gray-700 dark:text-gray-300">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 md:mr-3 flex-shrink-0 mt-0.5"
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
                <span>Управление сотрудниками и сменами</span>
              </li>
              <li className="flex items-start text-sm md:text-base text-gray-700 dark:text-gray-300">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 md:mr-3 flex-shrink-0 mt-0.5"
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
                <span>Визуальный календарь с назначением смен</span>
              </li>
              <li className="flex items-start text-sm md:text-base text-gray-700 dark:text-gray-300">
                <svg
                  className="w-5 h-5 text-green-500 mr-2 md:mr-3 flex-shrink-0 mt-0.5"
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
                <span>Автоматическое сохранение данных в браузере</span>
              </li>
              <li className="flex items-start text-sm md:text-base text-gray-400">
                <svg
                  className="w-5 h-5 text-gray-300 mr-2 md:mr-3 flex-shrink-0 mt-0.5"
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
                <span>Дополнительные инструменты (в разработке)</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
