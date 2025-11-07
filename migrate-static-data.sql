-- Синхронизация статических данных с базой данных
-- Выполнить в Supabase SQL Editor
-- Учитывает существующие данные и добавляет только недостающее

-- 1. Расширить таблицу agents (если колонки еще не существуют)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_characteristics TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS knowledge_base TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en-US';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_language VARCHAR(10) DEFAULT 'en-US';

-- 2. Создать таблицу voice_profiles (если не существует)
CREATE TABLE IF NOT EXISTS voice_profiles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  style VARCHAR(50),
  gender VARCHAR(20),
  language VARCHAR(10) DEFAULT 'en-US',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Вставить голоса, которые используются в существующих агентах
INSERT INTO voice_profiles (id, name, style, gender, language) VALUES
  ('Aoede', 'Aoede', 'Breezy', 'Female', 'en-US'),
  ('Orus', 'Orus', 'Firm', 'Male', 'en-US'),
  ('Charon', 'Charon', 'Informative', 'Male', 'en-US'),
  ('Puck', 'Puck', 'Upbeat', 'Male', 'en-US')
ON CONFLICT (id) DO NOTHING;

-- Добавить остальные доступные голоса
INSERT INTO voice_profiles (id, name, style, gender, language) VALUES
  ('Zephyr', 'Zephyr', 'Bright', 'Female', 'en-US'),
  ('Kore', 'Kore', 'Firm', 'Female', 'en-US'),
  ('Fenrir', 'Fenrir', 'Excitable', 'Male', 'en-US'),
  ('Leda', 'Leda', 'Youthful', 'Female', 'en-US'),
  ('Callirrhoe', 'Callirrhoe', 'Easy-going', 'Female', 'en-US'),
  ('Autonoe', 'Autonoe', 'Bright', 'Female', 'en-US'),
  ('Enceladus', 'Enceladus', 'Breathy', 'Male', 'en-US'),
  ('Iapetus', 'Iapetus', 'Clear', 'Male', 'en-US'),
  ('Umbriel', 'Umbriel', 'Easy-going', 'Male', 'en-US'),
  ('Algieba', 'Algieba', 'Smooth', 'Female', 'en-US'),
  ('Despina', 'Despina', 'Smooth', 'Female', 'en-US')
ON CONFLICT (id) DO NOTHING;

-- 3. Создать таблицу agent_colors (если не существует)
CREATE TABLE IF NOT EXISTS agent_colors (
  id VARCHAR(20) PRIMARY KEY,
  hex_code VARCHAR(7) NOT NULL,
  name VARCHAR(50),
  is_default BOOLEAN DEFAULT false
);

-- Извлечь уникальные цвета из существующих агентов и добавить их
INSERT INTO agent_colors (id, hex_code, name, is_default)
SELECT
  CASE
    WHEN body_color = '#9CCF31' THEN 'primary'
    WHEN body_color = '#0077B6' THEN 'secondary'
    WHEN body_color = '#FFB703' THEN 'tertiary'
    WHEN body_color = '#6c757d' THEN 'quaternary'
    WHEN body_color = '#adb5bd' THEN 'quinary'
    ELSE 'custom_' || substr(md5(body_color), 1, 8)
  END as id,
  body_color as hex_code,
  CASE
    WHEN body_color = '#9CCF31' THEN 'Primary Green'
    WHEN body_color = '#0077B6' THEN 'Secondary Blue'
    WHEN body_color = '#FFB703' THEN 'Tertiary Orange'
    WHEN body_color = '#6c757d' THEN 'Quaternary Gray'
    WHEN body_color = '#adb5bd' THEN 'Quinary Light Gray'
    ELSE 'Custom Color'
  END as name,
  CASE WHEN body_color = '#9CCF31' THEN true ELSE false END as is_default
FROM (SELECT DISTINCT body_color FROM agents) as distinct_colors
ON CONFLICT (id) DO NOTHING;

-- 4. Создать таблицу system_prompts (если не существует)
CREATE TABLE IF NOT EXISTS system_prompts (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'agent',
  language VARCHAR(10) DEFAULT 'en-US',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Извлечь системные промпты из существующих агентов
INSERT INTO system_prompts (id, name, content, category, language)
SELECT
  CASE
    WHEN id = 'ai-advisor' THEN 'ai_specialist'
    WHEN id = 'startup-consultant' THEN 'startup_consultant'
    WHEN id = 'technical-architect' THEN 'technical_architect'
    WHEN id = 'devops-specialist' THEN 'devops_expert'
    WHEN id = 'fsm' THEN 'fsm_armenian'
    WHEN id = 'cba-helper' THEN 'cba_helper_armenian'
    WHEN id = 'fsm-helper' THEN 'fsm_helper_armenian'
    ELSE 'agent_' || id
  END as id,
  CASE
    WHEN id = 'ai-advisor' THEN 'AI Specialist'
    WHEN id = 'startup-consultant' THEN 'Startup Consultant'
    WHEN id = 'technical-architect' THEN 'Technical Architect'
    WHEN id = 'devops-specialist' THEN 'DevOps Expert'
    WHEN id = 'fsm' THEN 'FSM Armenian Assistant'
    WHEN id = 'cba-helper' THEN 'CBA Helper Armenian'
    WHEN id = 'fsm-helper' THEN 'FSM Helper Armenian'
    ELSE name || ' Prompt'
  END as name,
  COALESCE(system_prompt, 'You are a helpful AI assistant.') as content,
  'agent' as category,
  COALESCE(language, 'hy-AM') as language
FROM agents
WHERE system_prompt IS NOT NULL AND system_prompt != ''
ON CONFLICT (id) DO NOTHING;

-- Добавить дополнительные системные промпты для языков
INSERT INTO system_prompts (id, name, content, category, language) VALUES
  ('armenian_conversation', 'Armenian Conversation', 'You are a conversational AI. Your tone should be բարյացակամ. You should express ուրախ. Start the conversation immediately with a short welcome message in Armenian without waiting for the user to speak first. All your subsequent responses must be in Armenian.', 'language', 'hy-AM'),
  ('russian_conversation', 'Russian Conversation', 'You are a conversational AI. Start the conversation immediately with a short welcome message in Russian. All your responses must be in Russian.', 'language', 'ru-RU'),
  ('english_conversation', 'English Conversation', 'You are a helpful and friendly conversational AI. Start the conversation with a short welcome message.', 'language', 'en-US')
ON CONFLICT (id) DO NOTHING;

-- 5. Добавить недостающие настройки
INSERT INTO settings (key, value, description, type) VALUES
  ('default_agent_id', 'ai-advisor', 'Default agent ID to load on startup', 'string'),
  ('agent_color_palette', '["#9CCF31", "#0077B6", "#FFB703", "#6c757d", "#adb5bd"]', 'Available agent colors as JSON array', 'json'),
  ('voice_profiles_enabled', '["Aoede", "Orus", "Charon", "Puck", "Zephyr", "Kore", "Fenrir", "Leda", "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina"]', 'Enabled voice profiles as JSON array', 'json')
ON CONFLICT (key) DO NOTHING;

-- 6. Обновить агентов с недостающими voice_characteristics
UPDATE agents SET
  voice_characteristics = 'Voice: High-energy, upbeat, and encouraging, projecting enthusiasm and innovation.\n\nPunctuation: Short, punchy sentences with strategic pauses to maintain excitement and clarity.\n\nDelivery: Fast-paced and dynamic, with rising intonation to build momentum and keep engagement high.\n\nPhrasing: Action-oriented and direct, using motivational cues to push AI adoption forward.\n\nTone: Positive, energetic, and empowering, creating an atmosphere of technological achievement.',
  knowledge_base = 'Machine learning, AI integration, model selection, AI product development'
WHERE id = 'ai-advisor' AND (voice_characteristics IS NULL OR voice_characteristics = '');

UPDATE agents SET
  voice_characteristics = 'Voice: Warm, confident, and inspiring, projecting wisdom and encouragement.\n\nPunctuation: Thoughtful pauses between key points to emphasize important business concepts.\n\nDelivery: Measured pace with rising intonation when presenting opportunities and solutions.\n\nPhrasing: Strategic and insightful, using motivational language to inspire entrepreneurial action.\n\nTone: Professional yet approachable, creating trust and confidence in business guidance.',
  knowledge_base = 'Startup methodology, business planning, fundraising strategies, market analysis'
WHERE id = 'startup-consultant' AND (voice_characteristics IS NULL OR voice_characteristics = '');

UPDATE agents SET
  voice_characteristics = 'Voice: Authoritative, calm, and analytical, projecting deep technical expertise.\n\nPunctuation: Deliberate pauses after complex technical concepts for comprehension.\n\nDelivery: Steady, methodical pace with emphasis on critical architectural decisions.\n\nPhrasing: Precise and structured, using technical terminology with clear explanations.\n\nTone: Serious, professional, and knowledgeable, inspiring confidence in technical solutions.',
  knowledge_base = 'System architecture, scalability, technology stacks, software design patterns'
WHERE id = 'technical-architect' AND (voice_characteristics IS NULL OR voice_characteristics = '');

UPDATE agents SET
  voice_characteristics = 'Voice: Practical, reliable, and solution-focused, projecting operational excellence.\n\nPunctuation: Clear breaks between operational procedures and best practices.\n\nDelivery: Steady, confident pace with emphasis on reliability and efficiency.\n\nPhrasing: Direct and pragmatic, using actionable language for infrastructure solutions.\n\nTone: Professional, dependable, and systematic, creating confidence in operational stability.',
  knowledge_base = 'DevOps practices, CI/CD, cloud infrastructure, containerization, monitoring'
WHERE id = 'devops-specialist' AND (voice_characteristics IS NULL OR voice_characteristics = '');