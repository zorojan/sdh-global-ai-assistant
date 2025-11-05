'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { settingsAPI } from '@/lib/api'

interface Setting {
  key: string
  value: string
  description: string
  type: string
}

interface ValidationStatus {
  [key: string]: {
    isValid: boolean
    isChecking: boolean
    message?: string
  }
}

export default function SettingsTab() {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>({})
  const queryClient = useQueryClient()

  const { data: settings = [], isLoading } = useQuery('settings', settingsAPI.getAll)

  const updateMutation = useMutation(
    ({ key, value }: { key: string; value: string }) => 
      settingsAPI.update(key, value),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('settings')
        setEditingKey(null)
        setEditValue('')
      }
    }
  )

  // Group settings by provider with improved categorization
  const groupedSettings = settings.reduce((groups: any, setting: Setting) => {
    let group = 'general'
    
    // Provider selection goes to its own group
    if (setting.key === 'ai_provider') {
      group = 'provider'
    }
    // Gemini specific settings 
    else if (setting.key.includes('gemini') || ['default_model', 'message_dialog_model'].includes(setting.key)) {
      group = 'gemini'
    }
    // OpenAI specific settings including voice/language (only for OpenAI)
    else if (setting.key.includes('openai') || ['default_language', 'default_voice'].includes(setting.key)) {
      group = 'openai'
    }
    // General system settings
    else if (['enable_audio', 'max_conversation_length'].includes(setting.key)) {
      group = 'general'
    }

    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(setting)
    return groups
  }, {})

  const aiProvider = settings.find((s: Setting) => s.key === 'ai_provider')?.value || 'gemini'

  // Helper function to determine if a setting should be visible based on current provider
  const shouldShowSetting = (settingKey: string, currentProvider: string): boolean => {
    // Provider selector and general settings are always visible
    const alwaysVisible = ['ai_provider', 'enable_audio', 'max_conversation_length']
    if (alwaysVisible.includes(settingKey)) {
      return true
    }

    // Filter based on provider with clear separation
    switch (currentProvider) {
      case 'openai':
        // OpenAI: show OpenAI settings + voice/language settings
        return settingKey.includes('openai') || 
               settingKey === 'default_language' || 
               settingKey === 'default_voice'
      case 'gemini':
        // Gemini: show Gemini settings + model settings + Gemini voice/language
        return settingKey.includes('gemini') || 
               settingKey === 'default_model' || 
               settingKey === 'message_dialog_model'
      case 'hybrid':
        // Hybrid: show all provider-specific settings
        return true
      default:
        return true
    }
  }

  // Filter grouped settings based on current provider
  const filteredGroupedSettings = Object.keys(groupedSettings).reduce((filtered: any, groupKey: string) => {
    const filteredGroup = groupedSettings[groupKey].filter((setting: Setting) => 
      shouldShowSetting(setting.key, aiProvider)
    )
    
    if (filteredGroup.length > 0) {
      filtered[groupKey] = filteredGroup
    }
    
    return filtered
  }, {})

  const validateApiKey = async (provider: 'gemini' | 'openai') => {
    const keyField = provider === 'gemini' ? 'gemini_api_key' : 'openai_api_key'
    
    setValidationStatus(prev => ({
      ...prev,
      [keyField]: { isValid: false, isChecking: true, message: 'Тестирование API ключа...' }
    }))

    try {
      const endpoint = provider === 'gemini' ? '/api/gemini/test' : '/api/openai/test'
      const response = await fetch(`http://localhost:3001${endpoint}`)
      
      if (!response.ok) {
        // Handle specific error codes
        if (response.status === 400) {
          setValidationStatus(prev => ({
            ...prev,
            [keyField]: { isValid: false, isChecking: false, message: '❌ API ключ не задан или неверен' }
          }))
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()

      setValidationStatus(prev => ({
        ...prev,
        [keyField]: {
          isValid: result.success,
          isChecking: false,
          message: result.success 
            ? `✅ ${provider.toUpperCase()} API работает корректно` 
            : `❌ ${result.error || 'Ошибка валидации API ключа'}`
        }
      }))
    } catch (error: any) {
      console.error(`${provider} API validation error:`, error)
      setValidationStatus(prev => ({
        ...prev,
        [keyField]: {
          isValid: false,
          isChecking: false,
          message: `🚫 Ошибка подключения к ${provider.toUpperCase()}: ${error.message || 'Неизвестная ошибка'}`
        }
      }))
    }
  }

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key)
    setEditValue(currentValue === '***hidden***' ? '' : currentValue)
  }

  const handleSave = async () => {
    if (editingKey) {
      await updateMutation.mutateAsync({ key: editingKey, value: editValue })
      
      // Auto-validate after saving API keys
      if (editingKey === 'gemini_api_key') {
        setTimeout(() => validateApiKey('gemini'), 500)
      } else if (editingKey === 'openai_api_key') {
        setTimeout(() => validateApiKey('openai'), 500)
      }
    }
  }

  const handleSelectChange = async (key: string, value: string) => {
    await updateMutation.mutateAsync({ key, value })
    
    // Auto-validate after changing AI provider
    if (key === 'ai_provider') {
      // Trigger validation for both providers after a brief delay
      setTimeout(() => {
        if (value === 'gemini' || value === 'hybrid') {
          validateApiKey('gemini')
        }
        if (value === 'openai' || value === 'hybrid') {
          validateApiKey('openai')
        }
      }, 500)
    }
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditValue('')
  }

  const renderSettingGroup = (groupName: string, groupSettings: Setting[], title: string, icon: string) => {
    const isProviderGroup = groupName !== 'general'
    const isActiveProvider = aiProvider === groupName || groupName === 'provider' || groupName === 'general'
    
    return (
      <div key={groupName} className={`bg-white rounded-lg shadow-sm border-2 ${
        isProviderGroup && !isActiveProvider ? 'border-gray-200 opacity-60' : 
        isActiveProvider ? 'border-blue-300' : 'border-gray-200'
      }`}>
        <div className={`px-4 py-3 border-b ${
          isActiveProvider ? 'bg-blue-50' : 'bg-gray-50'
        } rounded-t-lg`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{icon}</span>
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              {isProviderGroup && (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isActiveProvider ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {isActiveProvider ? 'Активен' : 'Неактивен'}
                </span>
              )}
            </div>
            
            {(groupName === 'gemini' || groupName === 'openai') && (
              <button
                onClick={() => validateApiKey(groupName as 'gemini' | 'openai')}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm"
                disabled={validationStatus[`${groupName}_api_key`]?.isChecking}
              >
                {validationStatus[`${groupName}_api_key`]?.isChecking ? (
                  <>
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Проверка...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Проверить</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {groupSettings.map((setting: Setting) => {
            const validation = validationStatus[setting.key]
            
            return (
              <div key={setting.key} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <label className="block text-sm font-medium text-gray-700">
                        {setting.description || setting.key}
                      </label>
                      
                      {validation && (
                        <div className="flex items-center space-x-1">
                          {validation.isChecking ? (
                            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <span className={`text-lg ${validation.isValid ? '✅' : '❌'}`}>
                              {validation.isValid ? '✅' : '❌'}
                            </span>
                          )}
                          <span className={`text-xs ${
                            validation.isValid ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {validation.message}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Select and Boolean fields - always show as selectors */}
                    {setting.type === 'select' || setting.type === 'boolean' ? (
                      <div className="flex items-center">
                        {setting.type === 'select' && setting.key === 'ai_provider' ? (
                          <select
                            value={setting.value}
                            onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                            disabled={updateMutation.isLoading}
                            className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="gemini">🔷 Gemini только</option>
                            <option value="openai">🤖 OpenAI только</option>
                            <option value="hybrid">🔄 Гибридный режим</option>
                          </select>
                        ) : setting.type === 'select' && setting.key === 'default_language' ? (
                          <select
                            value={setting.value}
                            onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                            disabled={updateMutation.isLoading}
                            className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="am">🇦🇲 Հայերեն</option>
                            <option value="en">🇺🇸 English</option>
                            <option value="ru">🇷🇺 Русский</option>
                            <option value="auto">🌐 Автоопределение</option>
                          </select>
                        ) : setting.type === 'select' && setting.key === 'default_voice' ? (
                          <select
                            value={setting.value}
                            onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                            disabled={updateMutation.isLoading}
                            className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="nova">✨ Nova (рекомендуется для армянского)</option>
                            <option value="alloy">🎭 Alloy (нейтральный)</option>
                            <option value="echo">👨 Echo (мужской)</option>
                            <option value="fable">🎎 Fable (британский)</option>
                            <option value="onyx">🎪 Onyx (глубокий)</option>
                            <option value="shimmer">🌟 Shimmer (мягкий)</option>
                          </select>
                        ) : setting.type === 'select' && setting.key === 'gemini_default_voice' ? (
                          <select
                            value={setting.value}
                            onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                            disabled={updateMutation.isLoading}
                            className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="Kore">👩 Kore (рекомендуется для армянского)</option>
                            <option value="Achernar">🌟 Achernar (женский)</option>
                            <option value="Aoede">🎵 Aoede (музыкальный)</option>
                            <option value="Charon">👨 Charon (мужской)</option>
                            <option value="Despina">💫 Despina (женский)</option>
                            <option value="Fenrir">🐺 Fenrir (мужской)</option>
                            <option value="Leda">🦢 Leda (женский)</option>
                            <option value="Puck">🧚 Puck (мужской)</option>
                          </select>
                        ) : setting.type === 'select' && setting.key === 'gemini_default_language' ? (
                          <select
                            value={setting.value}
                            onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                            disabled={updateMutation.isLoading}
                            className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="hy-AM">🇦🇲 Armenian (Հայերեն)</option>
                            <option value="en-US">🇺🇸 English (United States)</option>
                            <option value="ru-RU">🇷🇺 Russian (Русский)</option>
                            <option value="fr-FR">🇫🇷 French (Français)</option>
                            <option value="de-DE">🇩🇪 German (Deutsch)</option>
                            <option value="es-ES">🇪🇸 Spanish (Español)</option>
                            <option value="auto">🌐 Auto-detect</option>
                          </select>
                        ) : setting.type === 'select' && setting.key === 'gemini_tts_model' ? (
                          <select
                            value={setting.value}
                            onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                            disabled={updateMutation.isLoading}
                            className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="gemini-2.5-flash-tts">⚡ Gemini 2.5 Flash TTS (быстрый)</option>
                            <option value="gemini-2.5-pro-tts">💎 Gemini 2.5 Pro TTS (качественный)</option>
                          </select>
                        ) : setting.type === 'select' && (setting.key.includes('model') || setting.key.includes('chat') || setting.key.includes('stt') || setting.key.includes('tts')) ? (
                          <select
                            value={setting.value}
                            onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                            disabled={updateMutation.isLoading}
                            className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            {/* Gemini Models */}
                            {setting.key.includes('gemini') || setting.key === 'default_model' || setting.key === 'message_dialog_model' ? (
                              <>
                                <option value="gemini-2.5-flash-preview-native-audio-dialog">🎤 Gemini 2.5 Flash (Audio Dialog)</option>
                                <option value="gemini-1.5-flash">⚡ Gemini 1.5 Flash</option>
                                <option value="gemini-1.5-pro">💎 Gemini 1.5 Pro</option>
                              </>
                            ) : null}
                            
                            {/* OpenAI Models */}
                            {setting.key.includes('openai') || setting.key.includes('chat') ? (
                              <>
                                <option value="gpt-4o">🧠 GPT-4o (новейшая)</option>
                                <option value="gpt-4o-mini">⚡ GPT-4o Mini (быстрая)</option>
                                <option value="gpt-4-turbo">🚀 GPT-4 Turbo</option>
                              </>
                            ) : null}
                            
                            {/* STT Models */}
                            {setting.key.includes('stt') ? (
                              <>
                                <option value="gpt-4o-transcribe">🎙️ GPT-4o Transcribe (рекомендуется)</option>
                                <option value="whisper-1">👂 Whisper-1</option>
                              </>
                            ) : null}
                            
                            {/* TTS Models */}
                            {setting.key.includes('tts') ? (
                              <>
                                <option value="gpt-4o-mini-tts">🗣️ GPT-4o Mini TTS (быстрое)</option>
                                <option value="tts-1">🎵 TTS-1 (стандарт)</option>
                                <option value="tts-1-hd">💎 TTS-1 HD (высокое качество)</option>
                              </>
                            ) : null}
                            
                            {/* Fallback for unknown select types */}
                            {!(setting.key.includes('gemini') || setting.key.includes('openai') || setting.key.includes('model') || setting.key.includes('chat') || setting.key.includes('stt') || setting.key.includes('tts')) ? (
                              <option value={setting.value}>{setting.value}</option>
                            ) : null}
                          </select>
                        ) : setting.type === 'select' && setting.key.includes('enabled') ? (
                          <select
                            value={setting.value}
                            onChange={(e) => handleSelectChange(setting.key, e.target.value)}
                            disabled={updateMutation.isLoading}
                            className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          >
                            <option value="true">✅ Включено</option>
                            <option value="false">❌ Отключено</option>
                          </select>
                        ) : (
                          <select className="flex-1 form-select border border-gray-300 rounded-md px-3 py-2 bg-white">
                            <option>{setting.value || 'Не задано'}</option>
                          </select>
                        )}
                        
                        {updateMutation.isLoading && editingKey === setting.key && (
                          <div className="ml-2">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    ) : editingKey === setting.key ? (
                      /* Text, Number, Password fields - edit mode */
                      <div className="flex items-center space-x-2">
                        <input
                          type={setting.type === 'password' ? 'password' : setting.type === 'number' ? 'number' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 form-input border border-gray-300 rounded-md px-3 py-2"
                          placeholder={setting.type === 'password' ? 'Введите новое значение...' : ''}
                        />
                        
                        <button
                          onClick={handleSave}
                          disabled={updateMutation.isLoading}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm flex items-center"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancel}
                          className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm flex items-center"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      /* Text, Number, Password fields - display mode */
                      <div className="flex items-center justify-between">
                        <span className="text-sm px-3 py-2 rounded flex-1 mr-2 bg-gray-50 text-gray-900 border border-gray-200">
                          {setting.value || 'Не задано'}
                        </span>
                        <button
                          onClick={() => handleEdit(setting.key, setting.value)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm"
                        >
                          Изменить
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                <p className="mt-1 text-xs text-gray-500">
                  Ключ: {setting.key} | Тип: {setting.type}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🛠️ Настройки системы
        </h2>
        <p className="text-gray-600 mb-4">
          Конфигурация API ключей и системных параметров
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-lg">
              {aiProvider === 'gemini' && '🔷'}
              {aiProvider === 'openai' && '🤖'}
              {aiProvider === 'hybrid' && '🔄'}
            </span>
            <h3 className="font-medium text-blue-900">Текущий провайдер: {aiProvider.toUpperCase()}</h3>
          </div>
          <p className="text-sm text-blue-700">
            {aiProvider === 'gemini' && 'Показываются только настройки Google Gemini API и общие параметры'}
            {aiProvider === 'openai' && 'Показываются только настройки OpenAI API и общие параметры'}
            {aiProvider === 'hybrid' && 'Показываются настройки всех провайдеров для гибкого использования'}
          </p>
        </div>
      </div>

      {/* Provider Selection */}
      {filteredGroupedSettings.provider && renderSettingGroup(
        'provider',
        filteredGroupedSettings.provider,
        'Выбор провайдера и базовые настройки',
        '🔄'
      )}

      {/* Gemini Settings */}
      {filteredGroupedSettings.gemini && renderSettingGroup(
        'gemini',
        filteredGroupedSettings.gemini,
        'Google Gemini API',
        '🔷'
      )}

      {/* OpenAI Settings */}
      {filteredGroupedSettings.openai && renderSettingGroup(
        'openai',
        filteredGroupedSettings.openai,
        'OpenAI API',
        '🤖'
      )}

      {/* General Settings */}
      {filteredGroupedSettings.general && renderSettingGroup(
        'general',
        filteredGroupedSettings.general,
        'Общие настройки',
        '⚙️'
      )}

      {Object.keys(filteredGroupedSettings).length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-500">Настройки не найдены</p>
        </div>
      )}
    </div>
  )
}