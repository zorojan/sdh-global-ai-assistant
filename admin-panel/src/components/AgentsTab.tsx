'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { agentsAPI } from '../lib/api'
import { AVAILABLE_VOICES, AGENT_COLORS } from '../../../shared/types'

export default function AgentsTab() {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: agents, isLoading } = useQuery('agents', agentsAPI.getAll)

  const createMutation = useMutation(agentsAPI.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('agents')
      setShowCreateForm(false)
    }
  })

  const updateMutation = useMutation(
    ({ id, updates }: { id: string; updates: any }) =>
      agentsAPI.update(id, updates),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('agents')
        setEditingAgent(null)
      }
    }
  )

  const deleteMutation = useMutation(agentsAPI.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('agents')
    }
  })

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium text-gray-900">
              Управление агентами
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Создание и редактирование AI агентов/специалистов
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Создать агента
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <CreateAgentForm
          onCancel={() => setShowCreateForm(false)}
          onSubmit={createMutation.mutateAsync}
          isLoading={createMutation.isLoading}
        />
      )}

      {/* Edit Form */}
      {editingAgent && (
        <EditAgentForm
          agent={agents?.find((a: any) => a.id === editingAgent)}
          onCancel={() => setEditingAgent(null)}
          onSubmit={(updates: any) => updateMutation.mutateAsync({ id: editingAgent, updates })}
          isLoading={updateMutation.isLoading}
        />
      )}

      {/* Agents List */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent: any) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onEdit={() => setEditingAgent(agent.id)}
            onDelete={() => deleteMutation.mutateAsync(agent.id)}
            isDeleting={deleteMutation.isLoading}
          />
        ))}
      </div>

      {agents?.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Агенты не найдены</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Создать первого агента
          </button>
        </div>
      )}
    </div>
  )
}

function CreateAgentForm({ onCancel, onSubmit, isLoading }: any) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    personality: '',
    body_color: AGENT_COLORS[0] as any,
    voice: AVAILABLE_VOICES[0] as any,
    avatar_url: '',
    knowledge_base: '',
    system_prompt: '',
    language: 'en-US',
    voice_language: 'en-US'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Создать нового агента</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID агента
            </label>
            <input
              type="text"
              required
              value={formData.id}
              onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
              className="form-input"
              placeholder="startup-expert"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Имя агента
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="form-input"
              placeholder="Эксперт по стартапам"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Личность и роль
          </label>
          <textarea
            required
            rows={3}
            value={formData.personality}
            onChange={(e) => setFormData(prev => ({ ...prev, personality: e.target.value }))}
            className="form-input"
            placeholder="Опишите роль и личность агента..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Цвет
            </label>
            <select
              value={formData.body_color}
              onChange={(e) => setFormData(prev => ({ ...prev, body_color: e.target.value as any }))}
              className="form-input"
            >
              {AGENT_COLORS.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Голос
            </label>
            <select
              value={formData.voice}
              onChange={(e) => setFormData(prev => ({ ...prev, voice: e.target.value as any }))}
              className="form-input"
            >
              {AVAILABLE_VOICES.map(voice => (
                <option key={voice} value={voice}>{voice}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Язык текста
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
              className="form-input"
            >
              <option value="en-US">English (US)</option>
              <option value="ru-RU">Русский</option>
              <option value="hy-AM">Հայերեն (Armenian)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Язык голоса
            </label>
            <select
              value={formData.voice_language}
              onChange={(e) => setFormData(prev => ({ ...prev, voice_language: e.target.value }))}
              className="form-input"
            >
              <option value="en-US">English (US)</option>
              <option value="ru-RU">Русский</option>
              <option value="hy-AM">Հայերեն (Armenian)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            База знаний
          </label>
          <textarea
            rows={2}
            value={formData.knowledge_base}
            onChange={(e) => setFormData(prev => ({ ...prev, knowledge_base: e.target.value }))}
            className="form-input"
            placeholder="Ключевые области знаний агента..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Системный промпт
          </label>
          <textarea
            rows={2}
            value={formData.system_prompt}
            onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
            className="form-input"
            placeholder="Дополнительные инструкции для агента..."
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? 'Создание...' : 'Создать агента'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EditAgentForm({ agent, onCancel, onSubmit, isLoading }: any) {
  const [formData, setFormData] = useState({
    name: agent?.name || '',
    personality: agent?.personality || '',
    body_color: agent?.body_color || AGENT_COLORS[0],
    voice: agent?.voice || AVAILABLE_VOICES[0],
    avatar_url: agent?.avatar_url || '',
    knowledge_base: agent?.knowledge_base || '',
    system_prompt: agent?.system_prompt || '',
    language: agent?.language || 'en-US',
    voice_language: agent?.voice_language || 'en-US',
    is_active: agent?.is_active ?? true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Редактировать агента: {agent?.name}</h3>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Имя агента
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="form-input"
            placeholder="Эксперт по стартапам"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Личность и роль
          </label>
          <textarea
            required
            rows={3}
            value={formData.personality}
            onChange={(e) => setFormData(prev => ({ ...prev, personality: e.target.value }))}
            className="form-input"
            placeholder="Опишите роль и личность агента..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Цвет
            </label>
            <select
              value={formData.body_color}
              onChange={(e) => setFormData(prev => ({ ...prev, body_color: e.target.value as any }))}
              className="form-input"
            >
              {AGENT_COLORS.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Голос
            </label>
            <select
              value={formData.voice}
              onChange={(e) => setFormData(prev => ({ ...prev, voice: e.target.value as any }))}
              className="form-input"
            >
              {AVAILABLE_VOICES.map(voice => (
                <option key={voice} value={voice}>{voice}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Язык текста
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
              className="form-input"
            >
              <option value="en-US">English (US)</option>
              <option value="ru-RU">Русский</option>
              <option value="hy-AM">Հայերեն (Armenian)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Язык голоса
            </label>
            <select
              value={formData.voice_language}
              onChange={(e) => setFormData(prev => ({ ...prev, voice_language: e.target.value }))}
              className="form-input"
            >
              <option value="en-US">English (US)</option>
              <option value="ru-RU">Русский</option>
              <option value="hy-AM">Հայերեն (Armenian)</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            База знаний
          </label>
          <textarea
            rows={2}
            value={formData.knowledge_base}
            onChange={(e) => setFormData(prev => ({ ...prev, knowledge_base: e.target.value }))}
            className="form-input"
            placeholder="Ключевые области знаний агента..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Системный промпт
          </label>
          <textarea
            rows={2}
            value={formData.system_prompt}
            onChange={(e) => setFormData(prev => ({ ...prev, system_prompt: e.target.value }))}
            className="form-input"
            placeholder="Дополнительные инструкции для агента..."
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_active"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="mr-2"
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
            Активен
          </label>
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>
    </div>
  )
}

function AgentCard({ agent, onEdit, onDelete, isDeleting }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div
            className="w-8 h-8 rounded-full mr-3"
            style={{ backgroundColor: agent.body_color }}
          ></div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{agent.name}</h3>
            <p className="text-sm text-gray-500">Голос: {agent.voice}</p>
            {agent.language && (
              <p className="text-xs text-gray-400">Язык: {agent.language}</p>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm text-gray-600 mb-4 line-clamp-3">
        {agent.personality}
      </p>
      {agent.knowledge_base && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-1">База знаний:</h4>
          <p className="text-xs text-gray-600">{agent.knowledge_base}</p>
        </div>
      )}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <span className={`px-2 py-1 text-xs rounded-full ${
          agent.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {agent.is_active ? 'Активен' : 'Неактивен'}
        </span>
        <div className="flex space-x-2">
          <button
            onClick={onEdit}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs"
          >
            Изменить
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs disabled:opacity-50"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  )
}
