'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import SettingsTab from './SettingsTab'
import AgentsTab from './AgentsTab'
import WidgetGenerator from './WidgetGenerator'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('settings')
  const { user, logout } = useAuth()

  const tabs = [
    { id: 'settings', name: 'Настройки', icon: '⚙️' },
    { id: 'agents', name: 'Агенты', icon: '🤖' },
    { id: 'widgets', name: 'Виджеты', icon: '🔗' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <img
                src="https://sdh.global/s/1-44-1/img/logo.svg"
                alt="SDH Global"
                className="h-8 mr-4"
              />
              <h1 className="text-2xl font-bold text-gray-900">
                AI Assistant - Admin Panel
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Добро пожаловать, {user?.username}
              </span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex">
          {/* Sidebar */}
          <nav className="w-64 bg-white rounded-lg shadow p-6 mr-8">
            <div className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-100 text-indigo-700 border-l-4 border-indigo-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="mr-3 text-lg">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1">
            {activeTab === 'settings' && <SettingsTab />}
            {activeTab === 'agents' && <AgentsTab />}
            {activeTab === 'widgets' && <WidgetGenerator />}
          </main>
        </div>
      </div>
    </div>
  )
}
