import bcrypt from 'bcryptjs';
import prisma from './prismaClient';

export const initDatabase = async (): Promise<void> => {
  console.log('📦 Connected to database via Prisma');
  await createDefaults();
};

const createDefaults = async (): Promise<void> => {
  // Admin user
  const admin = await prisma.adminUser.findUnique({ where: { username: 'admin' } });
  if (!admin) {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await prisma.adminUser.create({ data: { username: 'admin', password_hash: hashedPassword } });
    console.log('👤 Default admin user created');
  }

  // Default settings
  const defaultSettings = [
    {
      key: 'gemini_api_key',
      value: process.env.GEMINI_API_KEY || '',
      description: 'Google Gemini API Key',
      type: 'password'
    },
    {
      key: 'default_model',
      value: 'gemini-2.5-flash-preview-native-audio-dialog',
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

  for (const s of defaultSettings) {
    const exists = await prisma.setting.findUnique({ where: { key: s.key } });
    if (!exists) {
      await prisma.setting.create({ data: s as any });
    }
  }

  // Default agents
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
    const exists = await prisma.agent.findUnique({ where: { id: agent.id } });
    if (!exists) {
      await prisma.agent.create({ data: agent as any });
    }
  }

  console.log('📚 Default data inserted (Prisma)');
};

export const getDatabase = () => {
  return prisma;
};
