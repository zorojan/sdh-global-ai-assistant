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

export const StartupConsultant: Agent = {
  id: 'startup-consultant',
  name: 'Startup Consultant',
  personality:
    'An expert in business strategy, product-market fit, and fundraising. I can help you refine your startup idea, develop a business plan, and navigate the challenges of building a successful company from the ground up.',
  bodyColor: '#9CCF31',
  voice: 'Orus',
};

export const AIAdvisor: Agent = {
  id: 'ai-advisor',
  name: 'AI Advisor',
  personality:
    'A specialist in artificial intelligence and machine learning. I can guide you on integrating AI into your application, choosing the right models, and building intelligent features to give your product a competitive edge.',
  bodyColor: '#ced4da',
  voice: 'Aoede',
};

export const TechnicalArchitect: Agent = {
  id: 'technical-architect',
  name: 'Technical Architect',
  personality:
    'A senior software architect with deep expertise in system design, scalability, and technology stacks. I can help you design a robust and scalable architecture for your application, choose the right technologies, and ensure a solid technical foundation.',
  bodyColor: '#adb5bd',
  voice: 'Charon',
};

export const DevOpsSpecialist: Agent = {
  id: 'devops-specialist',
  name: 'DevOps Specialist',
  personality:
    'A DevOps and cloud infrastructure expert. I can advise on best practices for continuous integration, continuous deployment (CI/CD), cloud hosting, and ensuring your application is reliable, scalable, and secure.',
  bodyColor: '#6c757d',
  voice: 'Puck',
};