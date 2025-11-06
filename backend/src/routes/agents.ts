import express from 'express';
import { supabase } from '../database/supabase';
import { authenticateToken } from './auth';

const router = express.Router();

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

// Basic chat endpoint
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

    // Get company information and Gemini API key
    const companyInfo = await getCompanyInfo();
    
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

    // Prepare the system prompt with company context
    const systemPrompt = `${agent.system_prompt || agent.personality || 'You are a helpful AI assistant.'}

Company Context:
- Company Name: ${companyInfo.company_name}
- Company Description: ${companyInfo.company_description}
- Website: ${companyInfo.company_website}
- Company Documents/Address Info: ${companyInfo.company_documents}

You are representing ${companyInfo.company_name}. Be helpful, professional, and knowledgeable about the company's services. 
IMPORTANT: Always use the exact information provided in the Company Context above, especially for addresses, contact information, and official details. Do not make up or guess any information about the company.`;

    console.log('🤖 Chat request details:', {
      message: message.substring(0, 100) + '...',
      agentId,
      agentName: agent.name,
      model,
      companyName: companyInfo.company_name,
      hasApiKey: !!apiKeySetting.value
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
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

export default router;