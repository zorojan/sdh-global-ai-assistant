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

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  language: string;
  source_type: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface UploadStats {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
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
  
  // RAG Knowledge Base states
  const [activeRAGTab, setActiveRAGTab] = useState<'upload' | 'manage' | 'stats'>('upload');
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocument[]>([]);
  const [isRAGLoading, setIsRAGLoading] = useState(false);
  const [ragMessage, setRagMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadStats | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [ragStats, setRagStats] = useState<{
    totalDocuments: number;
    categories: Record<string, number>;
    languages: Record<string, number>;
  }>({
    totalDocuments: 0,
    categories: {},
    languages: {}
  });

  useEffect(() => {
    fetchCompanyInfo();
    fetchKnowledgeBase();
    fetchRAGStats();
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

  // RAG Knowledge Base functions
  const fetchKnowledgeBase = async () => {
    try {
      setIsRAGLoading(true);
      const response = await fetch('/api/knowledge');
      if (!response.ok) throw new Error('Failed to fetch knowledge base');
      
      const data = await response.json();
      setKnowledgeDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      setRagMessage({ type: 'error', text: 'Ошибка загрузки базы знаний' });
    } finally {
      setIsRAGLoading(false);
    }
  };

  const fetchRAGStats = async () => {
    try {
      const response = await fetch('/api/knowledge/stats');
      if (!response.ok) throw new Error('Failed to fetch RAG stats');
      
      const data = await response.json();
      setRagStats(data);
    } catch (error) {
      console.error('Error fetching RAG stats:', error);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setRagMessage({ type: 'error', text: 'Выберите файлы для загрузки' });
      return;
    }

    try {
      setIsRAGLoading(true);
      const formData = new FormData();
      
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
      }

      const response = await fetch('/api/knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      setUploadProgress(result.stats);
      setRagMessage({ 
        type: 'success', 
        text: `Успешно загружено ${result.stats.successful} из ${result.stats.total} документов` 
      });

      // Refresh data
      fetchKnowledgeBase();
      fetchRAGStats();
    } catch (error) {
      console.error('Error uploading files:', error);
      setRagMessage({ type: 'error', text: 'Ошибка загрузки файлов' });
    } finally {
      setIsRAGLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот документ?')) return;

    try {
      setIsRAGLoading(true);
      const response = await fetch(`/api/knowledge/${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setRagMessage({ type: 'success', text: 'Документ успешно удален' });
      fetchKnowledgeBase();
      fetchRAGStats();
    } catch (error) {
      console.error('Error deleting document:', error);
      setRagMessage({ type: 'error', text: 'Ошибка удаления документа' });
    } finally {
      setIsRAGLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Сообщения */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* RAG Сообщения */}
      {ragMessage && (
        <div className={`mb-4 p-4 rounded-lg ${
          ragMessage.type === 'success' ? 'bg-green-100 text-green-700' : 
          ragMessage.type === 'error' ? 'bg-red-100 text-red-700' :
          'bg-blue-100 text-blue-700'
        }`}>
          {ragMessage.text}
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

      {/* База знаний RAG */}
      <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-800">🧠 База знаний RAG</h3>
            <p className="text-gray-600 mt-1">Управление документами для системы искусственного интеллекта</p>
          </div>
          <div className="bg-gradient-to-r from-purple-100 to-blue-100 px-4 py-2 rounded-lg">
            <div className="text-sm font-medium text-gray-700">
              📊 Документов: <span className="font-bold text-purple-600">{ragStats.totalDocuments}</span>
            </div>
          </div>
        </div>

        {/* RAG Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'upload' as const, name: '📤 Загрузка', icon: '📤' },
              { id: 'manage' as const, name: '📋 Управление', icon: '📋' },
              { id: 'stats' as const, name: '📊 Статистика', icon: '📊' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRAGTab(tab.id)}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeRAGTab === tab.id
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name.replace(/^[📤📋📊]\s*/, '')}
              </button>
            ))}
          </nav>
        </div>

        {/* RAG Content */}
        {activeRAGTab === 'upload' && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="space-y-4">
                <div className="text-4xl">📁</div>
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Загрузить документы</h4>
                  <p className="text-gray-600 mb-4">
                    Поддерживаются файлы: PDF, DOC, DOCX, TXT, MD, JSON
                  </p>
                </div>
                
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.json"
                  onChange={(e) => setSelectedFiles(e.target.files)}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                
                {selectedFiles && selectedFiles.length > 0 && (
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Выбрано файлов: {selectedFiles.length}
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto">
                      {Array.from(selectedFiles).map((file, index) => (
                        <li key={index} className="flex items-center">
                          <span className="mr-2">📄</span>
                          {file.name} ({Math.round(file.size / 1024)} KB)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleFileUpload}
                disabled={isRAGLoading || !selectedFiles || selectedFiles.length === 0}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRAGLoading ? 'Загрузка...' : 'Загрузить файлы'}
              </button>
              
              <button
                onClick={() => setSelectedFiles(null)}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Очистить выбор
              </button>
            </div>

            {uploadProgress && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Результаты загрузки:</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{uploadProgress.total}</div>
                    <div className="text-gray-600">Всего</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{uploadProgress.successful}</div>
                    <div className="text-gray-600">Успешно</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{uploadProgress.failed}</div>
                    <div className="text-gray-600">Ошибок</div>
                  </div>
                </div>
                {uploadProgress.errors.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-red-700 mb-2">Ошибки:</h5>
                    <ul className="text-sm text-red-600 space-y-1">
                      {uploadProgress.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeRAGTab === 'manage' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-gray-900">Управление документами</h4>
              <button
                onClick={fetchKnowledgeBase}
                disabled={isRAGLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                🔄 Обновить
              </button>
            </div>

            {isRAGLoading ? (
              <div className="text-center py-8">
                <div className="loading-spinner mx-auto mb-4"></div>
                <p className="text-gray-600">Загрузка документов...</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {knowledgeDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📭</div>
                    <p>Нет документов в базе знаний</p>
                  </div>
                ) : (
                  knowledgeDocuments.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 mb-1">{doc.title}</h5>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {doc.category}
                            </span>
                            <span>{doc.language}</span>
                            <span>{doc.source_type}</span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {doc.content.substring(0, 150)}...
                          </p>
                          <div className="mt-2 text-xs text-gray-500">
                            Создано: {new Date(doc.created_at).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="ml-4 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                        >
                          🗑️ Удалить
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {activeRAGTab === 'stats' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">📁 Категории документов</h4>
                {Object.entries(ragStats.categories).length === 0 ? (
                  <p className="text-gray-500">Нет данных</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(ragStats.categories).map(([category, count]) => (
                      <div key={category} className="flex justify-between items-center">
                        <span className="text-gray-700 capitalize">{category}</span>
                        <span className="font-semibold text-blue-600">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">🌐 Языки</h4>
                {Object.entries(ragStats.languages).length === 0 ? (
                  <p className="text-gray-500">Нет данных</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(ragStats.languages).map(([language, count]) => (
                      <div key={language} className="flex justify-between items-center">
                        <span className="text-gray-700">{language}</span>
                        <span className="font-semibold text-green-600">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-6">
              <h4 className="text-lg font-medium text-purple-800 mb-4">🔍 Тестирование RAG системы</h4>
              <div className="space-y-4">
                <p className="text-purple-700">
                  База знаний содержит <strong>{ragStats.totalDocuments}</strong> документов.
                  Система готова отвечать на вопросы, используя эти данные.
                </p>
                <div className="flex gap-3">
                  <a
                    href="http://localhost:5173"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                  >
                    🚀 Тестировать в приложении
                  </a>
                  <a
                    href="http://localhost:3001/api/rag/search"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                  >
                    🔧 API документация
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Дополнительная информация */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="text-lg font-medium text-blue-800 mb-2">ℹ️ Информация</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Название компании будет отображаться в приветственных сообщениях</li>
          <li>• Описание помогает AI-агентам лучше понимать контекст вашего бизнеса</li>
          <li>• Веб-сайт может использоваться для предоставления ссылок клиентам</li>
          <li>• Корпоративные документы помогают агентам следовать политикам компании</li>
          <li>• База знаний RAG позволяет AI отвечать на основе ваших корпоративных документов</li>
        </ul>
      </div>
    </div>
  );
}