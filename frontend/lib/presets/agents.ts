/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export const INTERLOCUTOR_VOICES = [
  'Aoede',
  'Charon',
  'Fenrir',
  'Kore',
  'Leda',
  'Orus',
  'Puck',
  'Zephyr',
] as const;

export type INTERLOCUTOR_VOICE = (typeof INTERLOCUTOR_VOICES)[number];

export type Agent = {
  id: string;
  name: string;
  personality: string;
  bodyColor: string;
  voice: INTERLOCUTOR_VOICE;
  avatarUrl?: string;
  language?: string;
  voiceLanguage?: string;
  voiceCharacteristics?: string;
};

export const AGENT_COLORS = ['#9CCF31', '#ced4da', '#adb5bd', '#6c757d'];

export const createNewAgent = (properties?: Partial<Agent>): Agent => {
  return {
    id: Math.random().toString(36).substring(2, 15),
    name: '',
    personality: '',
    avatarUrl: '',
    bodyColor: AGENT_COLORS[0],
    voice: Math.random() > 0.5 ? 'Charon' : 'Aoede',
    language: 'en-US',
    voiceLanguage: 'en-US',
    voiceCharacteristics: 'Voice: Professional and clear, projecting confidence and expertise.\n\nPunctuation: Natural pauses for clarity and emphasis.\n\nDelivery: Steady pace with appropriate emphasis on key points.\n\nPhrasing: Clear and direct communication style.\n\nTone: Helpful, knowledgeable, and approachable.',
    ...properties,
  };
};

// Static agents removed - all agents now loaded from database
// Previously: StartupConsultant, AIAdvisor, TechnicalArchitect, DevOpsSpecialist