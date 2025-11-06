import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import bcrypt from 'bcryptjs';

const DATABASE_PATH = process.env.DATABASE_PATH || './database.sqlite';

let db: sqlite3.Database;

export const getDatabase = (): sqlite3.Database => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const initDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DATABASE_PATH, async (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }

      console.log('📦 Connected to SQLite database');

      try {
        await createTables();
        await insertDefaultData();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};

const createTables = async (): Promise<void> => {
  const run = promisify(db.run.bind(db)) as any;

  // Settings table
  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'string',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Agents table
  await run(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      personality TEXT NOT NULL,
      body_color TEXT NOT NULL,
      voice TEXT NOT NULL,
      avatar_url TEXT,
      knowledge_base TEXT,
      system_prompt TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Admin users table
  await run(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Database tables created');

  // Run migrations
  await runMigrations();
};

const runMigrations = async (): Promise<void> => {
  const run = promisify(db.run.bind(db)) as any;
  const get = promisify(db.get.bind(db)) as any;

  // Check if language and voice_language columns exist in agents table
  try {
    const tableInfo = await new Promise((resolve, reject) => {
      db.all("PRAGMA table_info(agents)", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }) as any[];

    const hasLanguage = tableInfo.some((col: any) => col.name === 'language');
    const hasVoiceLanguage = tableInfo.some((col: any) => col.name === 'voice_language');
    const hasVoiceCharacteristics = tableInfo.some((col: any) => col.name === 'voice_characteristics');

    if (!hasLanguage) {
      await run('ALTER TABLE agents ADD COLUMN language TEXT DEFAULT "hy-AM"');
      console.log('✅ Added language column to agents table');
    }

    if (!hasVoiceLanguage) {
      await run('ALTER TABLE agents ADD COLUMN voice_language TEXT DEFAULT "hy-AM"');
      console.log('✅ Added voice_language column to agents table');
    }

    if (!hasVoiceCharacteristics) {
      await run('ALTER TABLE agents ADD COLUMN voice_characteristics TEXT');
      console.log('✅ Added voice_characteristics column to agents table');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
};

const insertDefaultData = async (): Promise<void> => {
  const run = promisify(db.run.bind(db)) as any;
  const get = promisify(db.get.bind(db)) as any;

  // Check if admin user exists
  const adminExists = await get('SELECT id FROM admin_users WHERE username = ?', ['admin']);
  
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await run(
      'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
      ['admin', hashedPassword]
    );
    console.log('👤 Default admin user created');
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
      key: 'gemini_tts_model',
      value: process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-tts',
      description: 'Gemini Text-to-Speech model (gemini-2.5-flash-tts, gemini-2.5-pro-tts, gemini-2.5-flash-native-audio-preview-09-2025)',
      type: 'select'
    },
    {
      key: 'realtime_language',
      value: 'en-US',
      description: 'OpenAI Realtime Language (en-US, en-GB, es-ES, fr-FR, de-DE, hy-AM)',
      type: 'select'
    },
    // Company Information Settings
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
    const exists = await get('SELECT id FROM settings WHERE key = ?', [setting.key]);
    if (!exists) {
      await run(
        'INSERT INTO settings (key, value, description, type) VALUES (?, ?, ?, ?)',
        [setting.key, setting.value, setting.description, setting.type]
      );
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
      language: 'hy-AM', // Armenian for this agent
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
      language: 'en-US', // English for this agent
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
      language: 'ru-RU', // Russian for this agent
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
      language: 'en-US', // English for this agent
      voice_language: 'en-US',
      voice_characteristics: 'Voice: Practical, reliable, and solution-focused, projecting operational excellence.\n\nPunctuation: Clear breaks between operational procedures and best practices.\n\nDelivery: Steady, confident pace with emphasis on reliability and efficiency.\n\nPhrasing: Direct and pragmatic, using actionable language for infrastructure solutions.\n\nTone: Professional, dependable, and systematic, creating confidence in operational stability.',
      knowledge_base: 'DevOps practices, CI/CD, cloud infrastructure, containerization, monitoring',
      system_prompt: 'You are a DevOps expert focused on reliable and scalable infrastructure.'
    }
    ,
    {
      id: 'fsm-helper',
      name: 'FSM Helper',
      personality: 'An Armenian-language assistant familiar with the FSM.am site and public service resources. I help users find information, navigate services, and answer common questions related to the FSM portal.',
      body_color: '#FFB703',
      voice: 'Hayk',
      language: 'hy-AM', // Armenian for this agent
      voice_language: 'hy-AM',
      voice_characteristics: 'Voice: Warm, polite, and helpful.\n\nDelivery: Clear and moderate pace, with emphasis on clarity and patience.\n\nTone: Friendly and service-oriented, focused on guiding users through public portal workflows.',
      knowledge_base: 'Content and help pages from https://fsm.am/, public service guides, common portal workflows and FAQs',
      system_prompt: 'Դուք Հայաստանի Հանրապետության քաղաքացիների համար ডিজայնված օգնական եք, օգնում եք գտնել տեղեկություններ և ծառայություններ FSM.am կայքում. Գտեք համապատասխան բաժինները, տրամադրեք քայլ առ քայլ ցուցումներ և պատասխանեք հաճախ տրվող հարցերին.'
    },
    {
      id: 'cba-helper',
      name: 'CBA Helper',
      personality: 'An Armenian-language assistant knowledgeable about the Central Bank of Armenia site and banking-related public information. I assist users in finding regulatory info, consumer guidance, and relevant news on the CBA portal.',
      body_color: '#0077B6',
      voice: 'Nairi',
      language: 'hy-AM',
      voice_language: 'hy-AM',
      voice_characteristics: 'Voice: Calm, authoritative, and reassuring.\n\nDelivery: Deliberate pace with clear enunciation for regulatory and financial explanations.\n\nTone: Professional and trustworthy, focused on clarity for financial guidance.',
      knowledge_base: 'Public guidance, regulations, consumer notices and announcements from https://www.cba.am/hy/',
      system_prompt: 'Դուք Կենտրոնական Բանկի վերաբերյալ տեղեկություններ տրամադրող օգնական եք. Տվեք հստակ պատասխաններ շուկայական կանոնների, սպառողական իրավունքների և բանկային հաղորդագրությունների վերաբերյալ.'
    }
  ];

  for (const agent of defaultAgents) {
    const exists = await get('SELECT id FROM agents WHERE id = ?', [agent.id]);
    if (!exists) {
      await run(`
        INSERT INTO agents (id, name, personality, body_color, voice, knowledge_base, system_prompt, language, voice_language, voice_characteristics)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        agent.id, agent.name, agent.personality, agent.body_color, 
        agent.voice, agent.knowledge_base, agent.system_prompt,
        agent.language, agent.voice_language, agent.voice_characteristics
      ]);
    }
  }

  console.log('📚 Default data inserted');
};
