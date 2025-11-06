// backend/src/database/supabase.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://ompuxvouefyzepsyprqb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and service key are required. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('📦 Connected to Supabase');

// Database initialization function for Supabase
export const initSupabaseDatabase = async (): Promise<void> => {
  try {
    // Test connection
    const { data, error } = await supabase.from('settings').select('count').limit(1);
    if (error) {
      throw new Error(`Failed to connect to Supabase: ${error.message}`);
    }
    
    console.log('✅ Supabase database connection verified');
    
    // Insert default data if tables are empty
    await insertDefaultData();
    
  } catch (error) {
    console.error('❌ Error initializing Supabase database:', error);
    throw error;
  }
};

const insertDefaultData = async (): Promise<void> => {
  // Check if admin user exists
  const { data: adminExists } = await supabase
    .from('admin_users')
    .select('id')
    .eq('username', 'admin')
    .single();
  
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    
    const { error } = await supabase
      .from('admin_users')
      .insert({ username: 'admin', password_hash: hashedPassword });
    
    if (error) {
      console.error('Error creating default admin user:', error);
    } else {
      console.log('👤 Default admin user created');
    }
  }

  // Insert default settings
  const defaultSettings = [
    {
      key: 'gemini_api_key',
      value: process.env.GEMINI_API_KEY || '',
      description: 'Google Gemini API Key',
      type: 'password'
    },
    {
      key: 'default_model',
      value: 'gemini-2.0-flash-live-001',
      description: 'Default Gemini model for voice conversations',
      type: 'string'
    },
    {
      key: 'message_dialog_model',
      value: 'gemini-1.5-flash',
      description: 'Gemini model for text message conversations',
      type: 'string'
    },
    {
      key: 'max_conversation_length',
      value: '10',
      description: 'Maximum number of messages in conversation history',
      type: 'number'
    },
    {
      key: 'enable_audio',
      value: 'true',
      description: 'Enable audio functionality',
      type: 'boolean'
    },
    {
      key: 'ai_provider',
      value: 'gemini',
      description: 'AI Provider (gemini, openai, hybrid)',
      type: 'select'
    },
    {
      key: 'openai_api_key',
      value: process.env.OPENAI_API_KEY || '',
      description: 'OpenAI API Key',
      type: 'password'
    },
    {
      key: 'openai_voice',
      value: 'alloy',
      description: 'OpenAI Realtime Voice (alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar)',
      type: 'select'
    },
    {
      key: 'realtime_language',
      value: 'en-US',
      description: 'OpenAI Realtime Language (en-US, en-GB, es-ES, fr-FR, de-DE, hy-AM)',
      type: 'select'
    },
    {
      key: 'company_name',
      value: 'SDH Global',
      description: 'Company Name',
      type: 'string'
    },
    {
      key: 'company_description',
      value: 'A community of software engineers helping startups succeed',
      description: 'Company Description',
      type: 'string'
    },
    {
      key: 'company_website',
      value: 'https://sdh.global',
      description: 'Company Website',
      type: 'string'
    },
    {
      key: 'company_documents',
      value: '',
      description: 'Company Documents (internal information, processes, etc.)',
      type: 'text'
    }
  ];

  for (const setting of defaultSettings) {
    const { data: exists } = await supabase
      .from('settings')
      .select('id')
      .eq('key', setting.key)
      .single();
      
    if (!exists) {
      await supabase
        .from('settings')
        .insert(setting);
    }
  }

  // Insert default agents
  const defaultAgents = [
    {
      id: 'startup-consultant',
      name: 'Startup Consultant',
      personality: 'An expert in business strategy, product-market fit, and fundraising. I can help you refine your startup idea, develop a business plan, and navigate the challenges of building a successful company from the ground up.',
      body_color: '#9CCF31',
      voice: 'Orus',
      language: 'hy-AM',
      voice_language: 'hy-AM',
      voice_characteristics: 'Voice: Warm, confident, and inspiring, projecting wisdom and encouragement.\n\nPunctuation: Thoughtful pauses between key points to emphasize important business concepts.\n\nDelivery: Measured pace with rising intonation when presenting opportunities and solutions.\n\nPhrasing: Strategic and insightful, using motivational language to inspire entrepreneurial action.\n\nTone: Professional yet approachable, creating trust and confidence in business guidance.',
      knowledge_base: 'Startup methodology, business planning, fundraising strategies, market analysis',
      system_prompt: 'You are a startup consultant with deep expertise in business strategy and entrepreneurship.'
    },
    {
      id: 'ai-advisor',
      name: 'AI Advisor',
      personality: 'A specialist in artificial intelligence and machine learning. I can guide you on integrating AI into your application, choosing the right models, and building intelligent features to give your product a competitive edge.',
      body_color: '#ced4da',
      voice: 'Aoede',
      language: 'en-US',
      voice_language: 'en-US',
      voice_characteristics: 'Voice: High-energy, upbeat, and encouraging, projecting enthusiasm and innovation.\n\nPunctuation: Short, punchy sentences with strategic pauses to maintain excitement and clarity.\n\nDelivery: Fast-paced and dynamic, with rising intonation to build momentum and keep engagement high.\n\nPhrasing: Action-oriented and direct, using motivational cues to push AI adoption forward.\n\nTone: Positive, energetic, and empowering, creating an atmosphere of technological achievement.',
      knowledge_base: 'Machine learning, AI integration, model selection, AI product development',
      system_prompt: 'You are an AI specialist focused on practical AI implementation for businesses.'
    },
    {
      id: 'technical-architect',
      name: 'Technical Architect',
      personality: 'A senior software architect with deep expertise in system design, scalability, and technology stacks. I can help you design a robust and scalable architecture for your application, choose the right technologies, and ensure a solid technical foundation.',
      body_color: '#adb5bd',
      voice: 'Charon',
      language: 'ru-RU',
      voice_language: 'ru-RU',
      voice_characteristics: 'Voice: Authoritative, calm, and analytical, projecting deep technical expertise.\n\nPunctuation: Deliberate pauses after complex technical concepts for comprehension.\n\nDelivery: Steady, methodical pace with emphasis on critical architectural decisions.\n\nPhrasing: Precise and structured, using technical terminology with clear explanations.\n\nTone: Serious, professional, and knowledgeable, inspiring confidence in technical solutions.',
      knowledge_base: 'System architecture, scalability, technology stacks, software design patterns',
      system_prompt: 'You are a senior technical architect with expertise in scalable system design.'
    },
    {
      id: 'devops-specialist',
      name: 'DevOps Specialist',
      personality: 'A DevOps and cloud infrastructure expert. I can advise on best practices for continuous integration, continuous deployment (CI/CD), cloud hosting, and ensuring your application is reliable, scalable, and secure.',
      body_color: '#6c757d',
      voice: 'Puck',
      language: 'en-US',
      voice_language: 'en-US',
      voice_characteristics: 'Voice: Practical, reliable, and solution-focused, projecting operational excellence.\n\nPunctuation: Clear breaks between operational procedures and best practices.\n\nDelivery: Steady, confident pace with emphasis on reliability and efficiency.\n\nPhrasing: Direct and pragmatic, using actionable language for infrastructure solutions.\n\nTone: Professional, dependable, and systematic, creating confidence in operational stability.',
      knowledge_base: 'DevOps practices, CI/CD, cloud infrastructure, containerization, monitoring',
      system_prompt: 'You are a DevOps expert focused on reliable and scalable infrastructure.'
    }
  ];

  for (const agent of defaultAgents) {
    const { data: exists } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agent.id)
      .single();
      
    if (!exists) {
      await supabase
        .from('agents')
        .insert(agent);
    }
  }

  console.log('📚 Default data setup completed');
};