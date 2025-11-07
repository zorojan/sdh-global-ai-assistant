import { create } from 'zustand';
import { Agent } from './presets/agents';
import { convertApiAgentToLocal } from './agent-adapter';
import { Agent as ApiAgent } from './api-client';

// API клиент
const API_BASE_URL = 'http://localhost:3001/api';

// Функция для получения агентов из API
async function fetchAgentsFromAPI(): Promise<Agent[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/agents`);
    if (!response.ok) throw new Error('Failed to fetch agents');
    
    const apiAgents: ApiAgent[] = await response.json();
    
    // Преобразуем данные из API в формат, который ожидает приложение
    return apiAgents
      .filter((agent: ApiAgent) => agent.is_active) // Только активные агенты
      .map(convertApiAgentToLocal);
  } catch (error) {
    console.error('Error fetching agents from API:', error);
    throw error; // No fallback to static agents - force database setup
  }
}

// 🎯 НОВАЯ ФУНКЦИЯ - Получить полную конфигурацию для Gemini Live API
export interface LiveApiConfig {
  connectionConfig: {
    model: string;
    config: {
      responseModalities: string[];
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: string;
          };
        };
      };
      inputAudioTranscription?: {};
      outputAudioTranscription?: {};
      systemInstruction: string;
    };
  };
  agentInfo: {
    id: string;
    name: string;
    personality: string;
    language: string;
    voice: string;
    voice_language: string;
  };
}

export async function fetchLiveApiConfig(agentId: string): Promise<LiveApiConfig> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/config/live-connection/${agentId}`);
    if (!response.ok) throw new Error('Failed to fetch Live API config');
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching Live API config:', error);
    throw error;
  }
}

// Store для агентов с API
export const useApiAgents = create<{
  agents: Agent[];
  current: Agent | null;
  loading: boolean;
  error: string | null;
  loadAgents: () => Promise<void>;
  setCurrent: (agent: Agent) => void;
}>((set, get) => ({
  agents: [],
  current: null,
  loading: false,
  error: null,
  
  loadAgents: async () => {
    try {
      set({ loading: true, error: null });
      const agents = await fetchAgentsFromAPI();
      set({ 
        agents,
        loading: false,
        current: get().current || agents[0] || null
      });
    } catch (error) {
      set({ 
        error: 'Не удалось загрузить агентов',
        loading: false
      });
    }
  },
  
  setCurrent: (agent: Agent) => {
    set({ current: agent });
  }
}));
