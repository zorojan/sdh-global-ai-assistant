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
      knowledge_base: 'Startup methodology, business planning, fundraising strategies, market analysis',
      system_prompt: 'You are a startup consultant with deep expertise in business strategy and entrepreneurship.'
    },
    {
      id: 'ai-advisor',
      name: 'AI Advisor',
      personality: 'A specialist in artificial intelligence and machine learning. I can guide you on integrating AI into your application, choosing the right models, and building intelligent features to give your product a competitive edge.',
      body_color: '#ced4da',
      voice: 'Aoede',
      knowledge_base: 'Machine learning, AI integration, model selection, AI product development',
      system_prompt: 'You are an AI specialist focused on practical AI implementation for businesses.'
    },
    {
      id: 'technical-architect',
      name: 'Technical Architect',
      personality: 'A senior software architect with deep expertise in system design, scalability, and technology stacks. I can help you design a robust and scalable architecture for your application, choose the right technologies, and ensure a solid technical foundation.',
      body_color: '#adb5bd',
      voice: 'Charon',
      knowledge_base: 'System architecture, scalability, technology stacks, software design patterns',
      system_prompt: 'You are a senior technical architect with expertise in scalable system design.'
    },
    {
      id: 'devops-specialist',
      name: 'DevOps Specialist',
      personality: 'A DevOps and cloud infrastructure expert. I can advise on best practices for continuous integration, continuous deployment (CI/CD), cloud hosting, and ensuring your application is reliable, scalable, and secure.',
      body_color: '#6c757d',
      voice: 'Puck',
      knowledge_base: 'DevOps practices, CI/CD, cloud infrastructure, containerization, monitoring',
      system_prompt: 'You are a DevOps expert focused on reliable and scalable infrastructure.'
    }
  ];

  for (const agent of defaultAgents) {
    const exists = await get('SELECT id FROM agents WHERE id = ?', [agent.id]);
    if (!exists) {
      await run(`
        INSERT INTO agents (id, name, personality, body_color, voice, knowledge_base, system_prompt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        agent.id, agent.name, agent.personality, agent.body_color, 
        agent.voice, agent.knowledge_base, agent.system_prompt
      ]);
    }
  }

  console.log('📚 Default data inserted');
};
