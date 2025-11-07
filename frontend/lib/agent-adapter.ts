import { Agent as ApiAgent } from '../lib/api-client'
import { Agent as LocalAgent, INTERLOCUTOR_VOICE } from '../lib/presets/agents'

// Convert API agent to local agent format
export function convertApiAgentToLocal(apiAgent: ApiAgent): LocalAgent {
  // Map database voice to available voice or use fallback
  const mappedVoice = mapDatabaseVoiceToLocal(apiAgent.voice);
  
  return {
    id: apiAgent.id,
    name: apiAgent.name,
    personality: apiAgent.personality,
    bodyColor: apiAgent.body_color,
    voice: mappedVoice,
    avatarUrl: apiAgent.avatar_url || '',
    language: apiAgent.language || 'en-US',
    voiceLanguage: apiAgent.voice_language || 'en-US',
    voiceCharacteristics: apiAgent.voice_characteristics || ''
  }
}

// Map database voice names to local INTERLOCUTOR_VOICE types
function mapDatabaseVoiceToLocal(databaseVoice: string): INTERLOCUTOR_VOICE {
  // Create a mapping from database voices to local voices
  const voiceMapping: Record<string, INTERLOCUTOR_VOICE> = {
    'Algieba': 'Aoede',
    'Aoede': 'Aoede',
    'Charon': 'Charon',
    'Fenrir': 'Fenrir',
    'Kore': 'Kore',
    'Leda': 'Leda',
    'Orus': 'Orus',
    'Puck': 'Puck',
    'Zephyr': 'Zephyr'
  };
  
  return voiceMapping[databaseVoice] || 'Aoede'; // Default fallback
}

// Convert local agent to API agent format
export function convertLocalAgentToApi(localAgent: LocalAgent): Partial<ApiAgent> {
  return {
    id: localAgent.id,
    name: localAgent.name,
    personality: localAgent.personality,
    body_color: localAgent.bodyColor,
    voice: localAgent.voice,
    avatar_url: localAgent.avatarUrl,
    language: localAgent.language,
    voice_language: localAgent.voiceLanguage,
    voice_characteristics: localAgent.voiceCharacteristics,
    is_active: true
  }
}
