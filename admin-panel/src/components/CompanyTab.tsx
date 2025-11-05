'use client';

import { useState, useEffect } from 'react';
import { settingsAPI } from '../lib/api';

interface CompanySettings {
  id?: number;
  company_name?: string;
  company_description?: string; 
  company_website?: string;
  company_documents?: string;
}

export default function CompanyTab() {
  const [companyInfo, setCompanyInfo] = useState<CompanySettings>({
    company_name: '',
    company_description: '',
    company_website: '',
    company_documents: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchCompanyInfo();
  }, []);

  const fetchCompanyInfo = async () => {
    try {
      setIsLoading(true);
      const settings = await settingsAPI.getAll();
      
      // Filter company-related settings
      const companySettings: CompanySettings = {};
      settings.forEach((setting: any) => {
        if (['company_name', 'company_description', 'company_website', 'company_documents'].includes(setting.key)) {
          companySettings[setting.key as keyof CompanySettings] = setting.value;
        }
      });
      
      setCompanyInfo(companySettings);
    } catch (error) {
      console.error('Ошибка загрузки информации о компании:', error);
      setMessage({ type: 'error', text: 'Ошибка загрузки информации о компании' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      
      // Update each company setting
      for (const [key, value] of Object.entries(companyInfo)) {
        if (key !== 'id' && value !== undefined) {
          await settingsAPI.update(key, value as string);
        }
      }
      
      // Note: Frontend cache will be cleared automatically on next API call
      setMessage({ type: 'success', text: 'Информация о компании успешно обновлена' });
    } catch (error) {
      console.error('Ошибка при сохранении данных:', error);
      setMessage({ type: 'error', text: 'Ошибка при сохранении данных' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setCompanyInfo(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Сообщения */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-6">Основная информация</h3>
        
        <div className="space-y-6">
          {/* Название компании */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название компании
            </label>
            <input
              type="text"
              value={companyInfo.company_name || ''}
              onChange={(e) => handleChange('company_name', e.target.value)}
              placeholder="SDH Global"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Описание компании */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Описание компании
            </label>
            <textarea
              value={companyInfo.company_description || ''}
              onChange={(e) => handleChange('company_description', e.target.value)}
              rows={4}
              placeholder="Краткое описание деятельности компании, миссии и ценностей..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
            />
          </div>

          {/* Веб-сайт компании */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Веб-сайт компании
            </label>
            <input
              type="url"
              value={companyInfo.company_website || ''}
              onChange={(e) => handleChange('company_website', e.target.value)}
              placeholder="https://www.example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Корпоративные документы */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Корпоративные документы и политики
            </label>
            <textarea
              value={companyInfo.company_documents || ''}
              onChange={(e) => handleChange('company_documents', e.target.value)}
              rows={8}
              placeholder="Опишите основные документы, политики компании, процедуры работы, стандарты обслуживания клиентов и другую важную корпоративную информацию, которая поможет AI-агентам лучше представлять вашу компанию..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
            />
            <p className="mt-1 text-sm text-gray-500">
              Эта информация будет использована AI-агентами для более точного представления вашей компании
            </p>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-3 mt-8">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </button>
          
          <button
            onClick={fetchCompanyInfo}
            disabled={isLoading}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      {/* Дополнительная информация */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="text-lg font-medium text-blue-800 mb-2">ℹ️ Информация</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Название компании будет отображаться в приветственных сообщениях</li>
          <li>• Описание помогает AI-агентам лучше понимать контекст вашего бизнеса</li>
          <li>• Веб-сайт может использоваться для предоставления ссылок клиентам</li>
          <li>• Корпоративные документы помогают агентам следовать политикам компании</li>
        </ul>
      </div>
    </div>
  );
}