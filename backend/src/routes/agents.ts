import express from 'express';
import { supabase } from '../database/supabase';
import { authenticateToken } from './auth';

const router = express.Router();

// Standardized language resolution function
const resolveLanguage = async (
  agent: any, 
  interactionType: 'chat' | 'audio' | 'realtime' = 'chat',
  provider: 'gemini' | 'openai' = 'gemini'
) => {
  try {
    // Priority 1: Agent-specific language settings
    let resolvedLanguage: string;
    
    if (interactionType === 'audio' || interactionType === 'realtime') {
      resolvedLanguage = agent?.voice_language || agent?.language;
    } else {
      resolvedLanguage = agent?.language;
    }
    
    if (resolvedLanguage && resolvedLanguage !== 'auto') {
      console.log(`🌐 Language resolved from agent (${interactionType}):`, resolvedLanguage);
      return resolvedLanguage;
    }
    
    // Priority 2: Provider-specific global settings
    let providerLanguageKey: string;
    switch (provider) {
      case 'gemini':
        providerLanguageKey = 'gemini_default_language';
        break;
      case 'openai':
        providerLanguageKey = interactionType === 'audio' || interactionType === 'realtime' 
          ? 'realtime_language' 
          : 'openai_chat_language';
        break;
      default:
        providerLanguageKey = 'gemini_default_language';
    }
    
    const { data: providerLanguageSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', providerLanguageKey)
      .single();
    
    if (providerLanguageSetting?.value && providerLanguageSetting.value !== 'auto') {
      console.log(`🌐 Language resolved from provider setting (${providerLanguageKey}):`, providerLanguageSetting.value);
      return providerLanguageSetting.value;
    }
    
    // Priority 3: General default language
    const { data: defaultLanguageSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'default_language')
      .single();
    
    if (defaultLanguageSetting?.value && defaultLanguageSetting.value !== 'auto') {
      console.log(`🌐 Language resolved from default setting:`, defaultLanguageSetting.value);
      return defaultLanguageSetting.value;
    }
    
    // Priority 4: Hardcoded fallback
    const fallbackLanguage = 'hy-AM'; // Armenian as primary fallback, then English
    console.log(`🌐 Language using fallback:`, fallbackLanguage);
    return fallbackLanguage;
    
  } catch (error) {
    console.error('Error resolving language:', error);
    return 'hy-AM'; // Safe fallback
  }
};

// Function to get company information from settings
const getCompanyInfo = async () => {
  const { data: settings, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['company_name', 'company_description', 'company_website', 'company_documents']);
  
  if (error) {
    console.error('Error fetching company settings:', error);
    return {
      company_name: 'SDH Global',
      company_description: '',
      company_website: '',
      company_documents: ''
    };
  }
  
  const companyInfo: any = {};
  settings.forEach((setting: any) => {
    companyInfo[setting.key] = setting.value;
  });
  
  return {
    company_name: companyInfo.company_name || 'SDH Global',
    company_description: companyInfo.company_description || '',
    company_website: companyInfo.company_website || '',
    company_documents: companyInfo.company_documents || ''
  };
};

// Get all agents
router.get('/', async (req: any, res: express.Response) => {
  try {
    const { data: agents, error } = await supabase
      .from('agents')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw error;
    }

    res.json(agents || []);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get specific agent
router.get('/:id', async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;

    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Agent not found' });
      }
      throw error;
    }

    res.json(agent);
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Create new agent (admin only)
router.post('/', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const {
      id,
      name,
      personality,
      body_color,
      voice,
      avatar_url,
      knowledge_base,
      system_prompt,
      language,
      voice_language,
      voice_characteristics
    } = req.body;

    if (!id || !name || !personality || !body_color || !voice) {
      return res.status(400).json({ 
        error: 'ID, name, personality, body_color, and voice are required' 
      });
    }

    // Check if agent already exists
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Agent with this ID already exists' });
    }

    // Create agent
    const { error } = await supabase
      .from('agents')
      .insert({
        id,
        name,
        personality,
        body_color,
        voice,
        avatar_url: avatar_url || null,
        knowledge_base: knowledge_base || null,
        system_prompt: system_prompt || null,
        language: language || 'en-US',
        voice_language: voice_language || 'en-US',
        voice_characteristics: voice_characteristics || null
      });

    if (error) {
      throw error;
    }

    res.status(201).json({ success: true, message: 'Agent created successfully' });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Update agent (admin only)
router.put('/:id', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData.id; // Don't allow ID updates

    // Check if agent exists
    const { data: existing, error: checkError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Agent not found' });
      }
      throw checkError;
    }

    // Update agent
    const { error } = await supabase
      .from('agents')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({ success: true, message: 'Agent updated successfully' });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Delete agent (admin only) - soft delete
router.delete('/:id', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;

    // Soft delete - set is_active to false
    const { error } = await supabase
      .from('agents')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw error;
    }

    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Basic chat endpoint with provider detection
router.post('/chat', async (req: any, res: express.Response) => {
  try {
    const { message, agentId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get agent details, with fallback to first available agent
    let agent = null;
    
    if (agentId && agentId !== 'default') {
      const { data } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('is_active', true)
        .single();
      agent = data;
    }
    
    if (!agent) {
      // Try to get first available agent as fallback
      const { data: agents } = await supabase
        .from('agents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (agents && agents.length > 0) {
        agent = agents[0];
        console.log(`Agent ${agentId} not found, using fallback agent: ${agent.id}`);
      } else {
        // Create a default agent response if no agents found
        agent = {
          id: 'default',
          name: 'AI Assistant',
          personality: 'I am a helpful AI assistant.',
          system_prompt: 'You are a helpful AI assistant.'
        };
        console.log('No agents found, using default agent');
      }
    }

    // Get company information and AI provider setting
    const companyInfo = await getCompanyInfo();
    
    const { data: providerSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'ai_provider')
      .single();

    const aiProvider = providerSetting?.value || 'gemini';
    console.log('🤖 AI Provider:', aiProvider);

    // Resolve language based on provider and agent
    const language = await resolveLanguage(agent, 'chat', aiProvider as 'gemini' | 'openai');
    console.log('🌐 Resolved language for chat:', language);

    // Route to appropriate AI service based on provider
    if (aiProvider === 'openai') {
      return await handleOpenAIChat(req, res, agent, companyInfo, language);
    } else {
      return await handleGeminiChat(req, res, agent, companyInfo, language);
    }

  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Handle Gemini chat
const handleGeminiChat = async (req: any, res: express.Response, agent: any, companyInfo: any, language: string) => {
  try {
    const { message } = req.body;

    const { data: apiKeySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .single();

    if (!apiKeySetting?.value) {
      return res.status(500).json({ 
        error: 'Gemini API key is not configured. Please set up the API key in the admin panel.' 
      });
    }

    // Get the message dialog model for text conversations
    const { data: modelSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'message_dialog_model')
      .single();

    const model = modelSetting?.value || 'gemini-1.5-flash';

    // Prepare the system prompt with company context and language instruction
    const systemPrompt = `${agent.system_prompt || agent.personality || 'You are a helpful AI assistant.'}

Company Context:
- Company Name: ${companyInfo.company_name}
- Company Description: ${companyInfo.company_description}
- Website: ${companyInfo.company_website}
- Company Documents/Address Info: ${companyInfo.company_documents}

You are representing ${companyInfo.company_name}. Be helpful, professional, and knowledgeable about the company's services. 
IMPORTANT: Always use the exact information provided in the Company Context above, especially for addresses, contact information, and official details. Do not make up or guess any information about the company.

Please respond in the language: ${language} (${language === 'hy-AM' ? 'Armenian' : language === 'en-US' ? 'English' : language})`;

    console.log('🤖 Chat request details:', {
      message: message.substring(0, 100) + '...',
      agentId: agent.id,
      agentName: agent.name,
      model,
      companyName: companyInfo.company_name,
      hasApiKey: !!apiKeySetting.value,
      language: language
    });

    console.log('🏢 Company information being sent to Gemini:', {
      name: companyInfo.company_name,
      website: companyInfo.company_website,
      documentsPreview: companyInfo.company_documents?.substring(0, 200) + '...',
      descriptionLength: companyInfo.company_description?.length || 0
    });

    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKeySetting.value}`;
      console.log('📡 Making Gemini API call to:', geminiUrl.replace(apiKeySetting.value, 'API_KEY_HIDDEN'));
      
      // Make API call to Gemini
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: systemPrompt + '\n\nUser: ' + message
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      console.log('📊 Gemini API response status:', geminiResponse.status, geminiResponse.statusText);

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        console.error('❌ Gemini API error response:', errorText);
        console.error('🔍 Request details:', { model, url: geminiUrl.replace(apiKeySetting.value, 'API_KEY_HIDDEN') });
        throw new Error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`);
      }

      const geminiData = await geminiResponse.json() as any;
      console.log('✅ Gemini API response received:', {
        candidatesCount: geminiData.candidates?.length || 0,
        hasContent: !!(geminiData.candidates?.[0]?.content),
        finishReason: geminiData.candidates?.[0]?.finishReason
      });
      
      // Extract the response text from Gemini's response
      let response = 'Sorry, I could not generate a response.';
      
      if (geminiData.candidates && geminiData.candidates.length > 0) {
        const candidate = geminiData.candidates[0];
        console.log('🔍 Processing candidate:', {
          hasContent: !!candidate.content,
          hasParts: !!(candidate.content?.parts),
          partsCount: candidate.content?.parts?.length || 0,
          finishReason: candidate.finishReason,
          safetyRatings: candidate.safetyRatings?.length || 0
        });
        
        if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
          response = candidate.content.parts[0].text;
          console.log('✅ Extracted response:', response.substring(0, 200) + '...');
        } else {
          console.log('❌ No content parts found in candidate');
          if (candidate.finishReason) {
            console.log('🛑 Finish reason:', candidate.finishReason);
          }
        }
      } else {
        console.log('❌ No candidates found in Gemini response');
        console.log('🔍 Full Gemini response:', JSON.stringify(geminiData, null, 2));
      }

      res.json({ 
        response: response.trim(),
        agent: {
          id: agent.id,
          name: agent.name
        }
      });

    } catch (geminiError: any) {
      console.error('Gemini API call failed:', geminiError);
      
      // Fallback response if Gemini fails
      const fallbackResponse = `Hello! I'm ${agent.name} from ${companyInfo.company_name}. I received your message: "${message}". I'm having trouble connecting to my AI service right now, but I'm here to help you with information about our services.`;
      
      res.json({ 
        response: fallbackResponse,
        agent: {
          id: agent.id,
          name: agent.name
        },
        warning: 'AI service temporarily unavailable, using fallback response'
      });
    }

  } catch (error: any) {
    console.error('Gemini chat error:', error);
    res.status(500).json({ error: 'Failed to process Gemini message' });
  }
};

// Handle OpenAI chat
const handleOpenAIChat = async (req: any, res: express.Response, agent: any, companyInfo: any, language: string) => {
  try {
    const { message } = req.body;

    const { data: apiKeySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .single();

    if (!apiKeySetting?.value) {
      return res.status(500).json({ 
        error: 'OpenAI API key is not configured. Please set up the API key in the admin panel.' 
      });
    }

    // Get the OpenAI model setting
    const { data: modelSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'openai_model')
      .single();

    const model = modelSetting?.value || 'gpt-4o-mini';

    // Prepare the system prompt with company context and language instruction
    const systemPrompt = `${agent.system_prompt || agent.personality || 'You are a helpful AI assistant.'}

Company Context:
- Company Name: ${companyInfo.company_name}
- Company Description: ${companyInfo.company_description}
- Website: ${companyInfo.company_website}
- Company Documents/Address Info: ${companyInfo.company_documents}

You are representing ${companyInfo.company_name}. Be helpful, professional, and knowledgeable about the company's services. 
IMPORTANT: Always use the exact information provided in the Company Context above, especially for addresses, contact information, and official details. Do not make up or guess any information about the company.

Please respond in the language: ${language} (${language === 'hy-AM' ? 'Armenian' : language === 'en-US' ? 'English' : language})`;

    console.log('🤖 OpenAI Chat request details:', {
      message: message.substring(0, 100) + '...',
      agentId: agent.id,
      agentName: agent.name,
      model,
      language,
      companyName: companyInfo.company_name,
      hasApiKey: !!apiKeySetting.value
    });

    try {
      // Make API call to OpenAI
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKeySetting.value}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 1024,
          temperature: 0.7
        })
      });

      console.log('📊 OpenAI API response status:', openaiResponse.status, openaiResponse.statusText);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('❌ OpenAI API error response:', errorText);
        throw new Error(`OpenAI API error: ${openaiResponse.status} ${openaiResponse.statusText}`);
      }

      const openaiData = await openaiResponse.json() as any;
      console.log('✅ OpenAI API response received:', {
        choicesCount: openaiData.choices?.length || 0,
        hasContent: !!(openaiData.choices?.[0]?.message?.content),
        finishReason: openaiData.choices?.[0]?.finish_reason
      });
      
      // Extract the response text from OpenAI's response
      let response = 'Sorry, I could not generate a response.';
      
      if (openaiData.choices && openaiData.choices.length > 0) {
        const choice = openaiData.choices[0];
        if (choice.message && choice.message.content) {
          response = choice.message.content;
          console.log('✅ Extracted OpenAI response:', response.substring(0, 200) + '...');
        } else {
          console.log('❌ No content found in OpenAI choice');
        }
      } else {
        console.log('❌ No choices found in OpenAI response');
      }

      res.json({ 
        response: response.trim(),
        agent: {
          id: agent.id,
          name: agent.name
        }
      });

    } catch (openaiError: any) {
      console.error('OpenAI API call failed:', openaiError);
      
      // Fallback response if OpenAI fails
      const fallbackResponse = `Hello! I'm ${agent.name} from ${companyInfo.company_name}. I received your message: "${message}". I'm having trouble connecting to my AI service right now, but I'm here to help you with information about our services.`;
      
      res.json({ 
        response: fallbackResponse,
        agent: {
          id: agent.id,
          name: agent.name
        },
        warning: 'AI service temporarily unavailable, using fallback response'
      });
    }

  } catch (error: any) {
    console.error('OpenAI chat error:', error);
    res.status(500).json({ error: 'Failed to process OpenAI message' });
  }
};

export default router;