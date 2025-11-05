import express from 'express';
import { getDatabase } from '../database/init';
import { authenticateToken } from './auth';
import { promisify } from 'util';
import axios from 'axios';

const router = express.Router();

// Armenian language system instructions
const generateArmenianSystemPrompt = (basePrompt: string): string => {
  const armenianInstructions = `

ВАЖНО - ЯЗЫКОВЫЕ ИНСТРУКЦИИ:
- Говори только на восточно-армянском языке (hy-AM)
- Избегай переключения на английский язык в середине предложения (code-switching)  
- Читай числа армянскими словами (например: "մեկ", "երկու", "երեք")
- Делай паузы на армянских знаках препинания: \u0589 (верджакет) и \u055D (бют)
- Используй правильную армянскую пунктуацию и грамматику
- Отвечай естественно на армянском, как носитель языка

LANGUAGE INSTRUCTIONS (Eastern Armenian):
- Speak exclusively in Eastern Armenian (hy-AM)
- Avoid English code-switching within sentences
- Read numbers in Armenian words (e.g., "մեկ", "երկու", "երեք")
- Pause at Armenian punctuation marks: \u0589 (full stop) and \u055D (comma)
- Use proper Armenian grammar and punctuation
- Respond naturally as a native Armenian speaker

`;

  return basePrompt + armenianInstructions;
};

// Get all agents
router.get('/', async (req: any, res: express.Response) => {
  try {
    const db = getDatabase();
    const all = promisify(db.all.bind(db)) as any;

    const agents = await all('SELECT * FROM agents WHERE is_active = 1 ORDER BY name') as any[];

    res.json(agents);
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get specific agent
router.get('/:id', async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;

    const agent = await get('SELECT * FROM agents WHERE id = ?', [id]) as any;

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
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
      system_prompt
    } = req.body;

    if (!id || !name || !personality || !body_color || !voice) {
      return res.status(400).json({ 
        error: 'ID, name, personality, body_color, and voice are required' 
      });
    }

    const db = getDatabase();
    const run = promisify(db.run.bind(db)) as any;
    const get = promisify(db.get.bind(db)) as any;

    // Check if agent already exists
    const existing = await get('SELECT * FROM agents WHERE id = ?', [id]) as any;
    if (existing) {
      return res.status(409).json({ error: 'Agent with this ID already exists' });
    }

    // Create agent
    await run(`
      INSERT INTO agents 
      (id, name, personality, body_color, voice, avatar_url, knowledge_base, system_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, name, personality, body_color, voice, 
      avatar_url || null, knowledge_base || null, system_prompt || null
    ]);

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
    const {
      name,
      personality,
      body_color,
      voice,
      avatar_url,
      knowledge_base,
      system_prompt,
      is_active
    } = req.body;

    const db = getDatabase();
    const run = promisify(db.run.bind(db)) as any;
    const get = promisify(db.get.bind(db)) as any;

    // Check if agent exists
    const existing = await get('SELECT * FROM agents WHERE id = ?', [id]) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (personality !== undefined) {
      updates.push('personality = ?');
      values.push(personality);
    }
    if (body_color !== undefined) {
      updates.push('body_color = ?');
      values.push(body_color);
    }
    if (voice !== undefined) {
      updates.push('voice = ?');
      values.push(voice);
    }
    if (avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      values.push(avatar_url);
    }
    if (knowledge_base !== undefined) {
      updates.push('knowledge_base = ?');
      values.push(knowledge_base);
    }
    if (system_prompt !== undefined) {
      updates.push('system_prompt = ?');
      values.push(system_prompt);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await run(
      `UPDATE agents SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ success: true, message: 'Agent updated successfully' });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Delete agent (admin only)
router.delete('/:id', authenticateToken, async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const run = promisify(db.run.bind(db)) as any;

    // Soft delete - set is_active to false
    await run('UPDATE agents SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Send message to agent (text chat)
router.post('/:id/message', async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;

    // Get agent details
    const agent = await get('SELECT * FROM agents WHERE id = ? AND is_active = 1', [id]) as any;
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get API key and message dialog model
    const apiKeySetting = await get('SELECT value FROM settings WHERE key = ?', ['gemini_api_key']) as any;
    const modelSetting = await get('SELECT value FROM settings WHERE key = ?', ['message_dialog_model']) as any;

    if (!apiKeySetting || !apiKeySetting.value) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const apiKey = apiKeySetting.value;
    const model = modelSetting?.value || 'gemini-1.5-flash';

    // Create system prompt with Armenian language instructions
    const baseSystemPrompt = agent.system_prompt || `You are ${agent.name}. ${agent.personality}`;
    const systemPrompt = generateArmenianSystemPrompt(baseSystemPrompt);

    // Call Gemini API
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `User: ${message.trim()}` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    const response = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    res.json({ response });
  } catch (error) {
    console.error('Send message error:', error);
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      
      // Handle specific error cases
      if (status === 503) {
        return res.status(503).json({ 
          error: 'API service is temporarily unavailable. This usually means the API quota has been exceeded or the service is down. Please try again later or check your API key configuration.' 
        });
      } else if (status === 429) {
        return res.status(429).json({ 
          error: 'Too many requests. Please wait a moment before trying again.' 
        });
      } else if (status === 401) {
        return res.status(401).json({ 
          error: 'Invalid API key. Please check your Gemini API key configuration in the admin panel.' 
        });
      } else if (status === 400) {
        return res.status(400).json({ 
          error: 'Invalid request. Please check your message and try again.' 
        });
      }
      
      const message = error.response?.data?.error?.message || 'Failed to get response from AI';
      return res.status(status).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Send message to agent with conversation history (for widget chat)
router.post('/:id/chat', async (req: any, res: express.Response) => {
  try {
    const { id } = req.params;
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;
    const all = promisify(db.all.bind(db)) as any;

    // Get agent details, with fallback to first available agent
    let agent = await get('SELECT * FROM agents WHERE id = ? AND is_active = 1', [id]) as any;
    
    if (!agent) {
      // Try to get first available agent as fallback
      const agents = await all('SELECT * FROM agents WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1') as any[];
      if (agents.length > 0) {
        agent = agents[0];
        console.log(`Agent ${id} not found, using fallback agent: ${agent.id}`);
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

    // Get API key and message dialog model
    const apiKeySetting = await get('SELECT value FROM settings WHERE key = ?', ['gemini_api_key']) as any;
    const modelSetting = await get('SELECT value FROM settings WHERE key = ?', ['message_dialog_model']) as any;

    if (!apiKeySetting || !apiKeySetting.value) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const apiKey = apiKeySetting.value;
    const model = modelSetting?.value || 'gemini-1.5-flash';

    // Create system prompt with Armenian language instructions
    const baseSystemPrompt = agent.system_prompt || `You are ${agent.name}. ${agent.personality}`;
    const systemPrompt = generateArmenianSystemPrompt(baseSystemPrompt);

    // Build conversation contents from history with proper roles
    const contents = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      }
    ];

    // Add conversation history
    if (history && Array.isArray(history)) {
      history.forEach((msg: any) => {
        if (msg.role === 'user') {
          contents.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else if (msg.role === 'assistant') {
          contents.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      });
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: message.trim() }]
    });

    // Call Gemini API
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 1024,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    const response = geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    res.json({ response });
  } catch (error) {
    console.error('Send chat message error:', error);
    if (axios.isAxiosError(error)) {
      // Log detailed error information
      console.error('Gemini API Error Details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      const status = error.response?.status || 500;
      
      // Handle specific error cases
      if (status === 503) {
        return res.status(503).json({ 
          error: 'API service is temporarily unavailable. This usually means the API quota has been exceeded or the service is down. Please try again later or check your API key configuration.' 
        });
      } else if (status === 429) {
        return res.status(429).json({ 
          error: 'Too many requests. Please wait a moment before trying again.' 
        });
      } else if (status === 401) {
        return res.status(401).json({ 
          error: 'Invalid API key. Please check your Gemini API key configuration in the admin panel.' 
        });
      } else if (status === 400) {
        const errorMessage = error.response?.data?.error?.message || 'Invalid request. Please check your message and try again.';
        console.error('400 Bad Request - Error message:', errorMessage);
        return res.status(400).json({ 
          error: errorMessage
        });
      }
      
      const message = error.response?.data?.error?.message || 'Failed to get response from AI';
      return res.status(status).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Helper function for OpenAI chat
async function callOpenAI(messages: any[], systemPrompt: string, apiKey: string) {
  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((msg: any) => ({
      role: msg.role === 'model' ? 'assistant' : msg.role,
      content: typeof msg.content === 'string' ? msg.content : msg.parts?.[0]?.text || ''
    }))
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`OpenAI API error: ${response.status} - ${errorData}`);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
}

// Helper function for Gemini chat
async function callGemini(messages: any[], apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
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
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error(`Gemini API error: ${response.status} - ${errorData}`);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json() as any;
  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error('Unexpected response format from Gemini');
  }

  return data.candidates[0].content.parts[0].text;
}

// General chat endpoint that accepts agentId in body
router.post('/chat', async (req: any, res: express.Response) => {
  try {
    const { message, agentId, history = [], provider } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;
    const all = promisify(db.all.bind(db)) as any;

    // Get agent details, with fallback to first available agent
    let agent = null;
    
    if (agentId && agentId !== 'default') {
      agent = await get('SELECT * FROM agents WHERE id = ? AND is_active = 1', [agentId]) as any;
    }
    
    if (!agent) {
      // Try to get first available agent as fallback
      const agents = await all('SELECT * FROM agents WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1') as any[];
      if (agents.length > 0) {
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

    console.log(`Processing chat for agent: ${agent.id} (${agent.name})`);

    // Build system prompt with Armenian language instructions
    let baseSystemPrompt = agent.personality || 'You are a helpful AI assistant.';
    if (agent.knowledge_base) {
      baseSystemPrompt += `\n\nKnowledge Base: ${agent.knowledge_base}`;
    }
    if (agent.system_prompt) {
      baseSystemPrompt += `\n\nAdditional Instructions: ${agent.system_prompt}`;
    }
    
    // Apply Armenian language instructions
    const systemPrompt = generateArmenianSystemPrompt(baseSystemPrompt);

    // Prepare messages for Gemini
    const messages = [];
    
    // Add system prompt
    messages.push({
      role: 'user',
      parts: [{ text: `System: ${systemPrompt}` }]
    });
    
    // Add conversation history if provided
    if (history && history.length > 0) {
      history.forEach((msg: any) => {
        if (msg.role === 'user') {
          messages.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else if (msg.role === 'assistant') {
          messages.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      });
    }
    
    // Add current user message
    messages.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Get Gemini API key from settings
    const settings = await all('SELECT * FROM settings') as any[];
    const geminiApiKeySetting = settings.find((s: any) => s.key === 'gemini_api_key');
    
    if (!geminiApiKeySetting || !geminiApiKeySetting.value || geminiApiKeySetting.value === 'your-api-key-here') {
      console.error('Gemini API key not configured');
      return res.status(500).json({ 
        error: 'AI service is not configured. Please set up the Gemini API key in the admin panel.' 
      });
    }

    const apiKey = geminiApiKeySetting.value;

    // Call Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: messages,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
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
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Gemini API error: ${response.status} - ${errorData}`);
      
      const status = response.status;
      if (status === 503) {
        return res.status(503).json({ 
          error: 'AI service is temporarily unavailable. This usually means the API quota has been exceeded or the service is down. Please try again later or check your API key configuration.' 
        });
      } else if (status === 429) {
        return res.status(429).json({ 
          error: 'Too many requests. Please wait a moment before trying again.' 
        });
      } else if (status === 401) {
        return res.status(401).json({ 
          error: 'Invalid API key. Please check your Gemini API key configuration in the admin panel.' 
        });
      } else if (status === 400) {
        const errorMessage = errorData || 'Invalid request. Please check your message and try again.';
        console.error('400 Bad Request - Error message:', errorMessage);
        return res.status(400).json({ 
          error: errorMessage
        });
      }
      
      return res.status(status).json({ error: 'Failed to get response from AI' });
    }

    const data = await response.json() as any;
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Unexpected response format from Gemini:', data);
      return res.status(500).json({ error: 'Unexpected response format from AI service' });
    }

    const assistantResponse = data.candidates[0].content.parts[0].text;
    
    res.json({ 
      response: assistantResponse,
      agent: {
        id: agent.id,
        name: agent.name
      }
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    
    if (error.response) {
      const status = error.response.status;
      if (status === 503) {
        return res.status(503).json({ 
          error: 'AI service is temporarily unavailable. This usually means the API quota has been exceeded or the service is down. Please try again later or check your API key configuration.' 
        });
      } else if (status === 429) {
        return res.status(429).json({ 
          error: 'Too many requests. Please wait a moment before trying again.' 
        });
      } else if (status === 401) {
        return res.status(401).json({ 
          error: 'Invalid API key. Please check your Gemini API key configuration in the admin panel.' 
        });
      } else if (status === 400) {
        const errorMessage = error.response?.data?.error?.message || 'Invalid request. Please check your message and try again.';
        console.error('400 Bad Request - Error message:', errorMessage);
        return res.status(400).json({ 
          error: errorMessage
        });
      }
      
      const message = error.response?.data?.error?.message || 'Failed to get response from AI';
      return res.status(status).json({ error: message });
    }
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
