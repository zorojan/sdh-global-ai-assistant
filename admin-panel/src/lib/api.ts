import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('admin_token')
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password })
    return response.data
  },
  
  verify: async () => {
    const response = await api.get('/auth/verify')
    return response.data
  }
}

// Settings API
export const settingsAPI = {
  getAll: async () => {
    const response = await api.get('/settings')
    return response.data
  },
  
  get: async (key: string) => {
    const response = await api.get(`/settings/${key}`)
    return response.data
  },
  
  update: async (key: string, value: string) => {
    const response = await api.put(`/settings/${key}`, { value })
    return response.data
  },
  
  create: async (setting: {
    key: string
    value: string
    description?: string
    type?: string
  }) => {
    const response = await api.post('/settings', setting)
    return response.data
  },
  
  delete: async (key: string) => {
    const response = await api.delete(`/settings/${key}`)
    return response.data
  }
}

// Agents API
export const agentsAPI = {
  getAll: async () => {
    const response = await api.get('/agents')
    return response.data
  },
  
  get: async (id: string) => {
    const response = await api.get(`/agents/${id}`)
    return response.data
  },
  
  create: async (agent: {
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
  }) => {
    const response = await api.post('/agents', agent)
    return response.data
  },
  
  update: async (id: string, updates: any) => {
    const response = await api.put(`/agents/${id}`, updates)
    return response.data
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/agents/${id}`)
    return response.data
  },

  // New database-driven endpoints
  getColors: async () => {
    const response = await api.get('/agents/colors')
    return response.data
  },

  getVoices: async () => {
    const response = await api.get('/agents/voices')
    return response.data
  },

  getSystemPrompts: async () => {
    const response = await api.get('/agents/prompts')
    return response.data
  },

  getSystemPromptsByCategory: async (category: string) => {
    const response = await api.get(`/agents/prompts/${category}`)
    return response.data
  }
}
