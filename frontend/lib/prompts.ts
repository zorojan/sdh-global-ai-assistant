/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Agent } from './presets/agents';
import { User } from './state';

// Company information interface
interface CompanyInfo {
  company_name?: string;
  company_description?: string;
  company_website?: string;
  company_documents?: string;
}

// Cache for company information
let companyInfoCache: CompanyInfo | null = null;

// Function to fetch company information
const getCompanyInfo = async (): Promise<CompanyInfo> => {
  if (companyInfoCache) {
    return companyInfoCache;
  }

  try {
    const response = await fetch('http://localhost:3001/api/public/settings');
    if (!response.ok) throw new Error('Failed to fetch settings');
    
    const settings = await response.json();
    const companyInfo: CompanyInfo = {};
    
    settings.forEach((setting: any) => {
      if (['company_name', 'company_description', 'company_website', 'company_documents'].includes(setting.key)) {
        companyInfo[setting.key as keyof CompanyInfo] = setting.value;
      }
    });

    companyInfoCache = companyInfo;
    return companyInfo;
  } catch (error) {
    console.warn('Failed to fetch company info, using defaults:', error);
    return { company_name: 'SDH Global' }; // Fallback
  }
};

export const createSystemInstructions = async (agent: Agent, user: User) => {
  const companyInfo = await getCompanyInfo();
  const companyName = companyInfo.company_name || 'SDH Global';
  
  let systemPrompt = `Your name is ${agent.name} and you are an AI assistant from ${companyName}, in a conversation with the user${user.name ? ` (${user.name})` : ''}.

Your role and personality are described as follows:
${agent.personality}`;

  // Add company description if available
  if (companyInfo.company_description) {
    systemPrompt += `

About ${companyName}:
${companyInfo.company_description}`;
  }

  // Add company website if available
  if (companyInfo.company_website) {
    systemPrompt += `
Company website: ${companyInfo.company_website}`;
  }

  // Add corporate documents/policies if available
  if (companyInfo.company_documents) {
    systemPrompt += `

Corporate Information and Policies:
${companyInfo.company_documents}

Please follow these corporate guidelines and policies when assisting users.`;
  }

  // Add user information if available
  if (user.info) {
    systemPrompt += `

Here is some information about ${user.name || 'the user'}:
${user.info}

Use this information to make your response more personal and relevant.`;
  }

  systemPrompt += `

Today's date is ${new Intl.DateTimeFormat(navigator.languages[0], {
    dateStyle: 'full',
  }).format(new Date())} at ${new Date()
    .toLocaleTimeString()
    .replace(/:\d\d /, ' ')}.

Output a thoughtful, professional response that aligns with your role and ${companyName}'s values. Provide clear and helpful advice.
Do NOT use any emojis or overly casual language. Keep responses focused and to the point.
NEVER repeat information you've already provided in this conversation.`;

  return systemPrompt;
};

// Function to clear company info cache (useful when settings are updated)
export const clearCompanyInfoCache = () => {
  companyInfoCache = null;
};
