import axios from 'axios'

const API_BASE_URL = 'http://localhost:3001/api'

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Types
export interface Agent {
  id: string
  name: string
  personality: string
  body_color: string
  voice: string
  avatar_url?: string
  knowledge_base?: string
  system_prompt?: string
  language?: string
  voice_language?: string
  voice_characteristics?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Setting {
  key: string
  value: string
  description?: string
  type: 'string' | 'number' | 'boolean' | 'json'
}

// API functions
export const api = {
  // Get all active agents
  getAgents: async (): Promise<Agent[]> => {
    const response = await apiClient.get('/agents')
    return response.data.filter((agent: Agent) => agent.is_active)
  },

  // Get specific agent by ID
  getAgent: async (id: string): Promise<Agent> => {
    const response = await apiClient.get(`/agents/${id}`)
    return response.data
  },

  // Get all settings
  getSettings: async (): Promise<Setting[]> => {
    const response = await apiClient.get('/settings')
    return response.data
  },

  // Get specific setting
  getSetting: async (key: string): Promise<string> => {
    const response = await apiClient.get(`/settings/${key}`)
    return response.data.value
  },

  // Health check
  healthCheck: async (): Promise<{ status: string; timestamp: string }> => {
    const response = await apiClient.get('/health')
    return response.data
  },

  // Send text message to agent
  sendMessage: async (agentId: string, message: string, provider?: string): Promise<string> => {
    try {
      const response = await apiClient.post('/agents/chat', {
        message: message,
        agentId: agentId,
        provider: provider
      })
      return response.data.response
    } catch (error) {
      // Re-throw the error with the server's error message if available
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(`${error.response.status}: ${error.response.data.error}`)
      }
      throw error
    }
  }
}

export default api
