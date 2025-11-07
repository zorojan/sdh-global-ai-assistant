# План миграции статических данных в Supabase

## 🎯 **Цель**
Перенести ВСЕ статические данные из кода в базу данных Supabase, чтобы админ мог управлять всеми настройками через интерфейс.

## 📊 **Найденные статические данные**

### 1. **Агенты** (`backend/src/database/supabase.ts`)
```typescript
// 4 статических агента с полными профилями:
- Startup Consultant (Orus, hy-AM)
- AI Advisor (Aoede, en-US) 
- Technical Architect (Charon, ru-RU)
- DevOps Specialist (Puck, en-US)
```

### 2. **Live API настройки** (уже частично в БД)
```typescript
// Уже в settings:
- live_api_model: 'gemini-2.5-flash-native-audio-preview-09-2025'
- live_api_voice_name: 'Zephyr'
- live_api_response_modalities: 'AUDIO'
- live_api_enable_input_transcription: 'false'
- live_api_enable_output_transcription: 'true'
- live_api_temperature: '0.8'
- live_api_system_instruction: 'You are a conversational AI...'

// Дефолты в коде (нужно убрать):
- model: 'gemini-2.5-flash-native-audio-preview-09-2025'
- voiceName: 'Zephyr'
- temperature: 0.8
- systemInstruction: 'You are a helpful AI assistant.'
```

### 3. **Системные промпты агентов**
```typescript
// В каждом агенте:
- system_prompt: 'You are a startup consultant...'
- system_prompt: 'You are an AI specialist...'
- system_prompt: 'You are a senior technical architect...'
- system_prompt: 'You are a DevOps expert...'
```

### 4. **Списки голосов** (`frontend/lib/presets/agents.ts`)
```typescript
INTERLOCUTOR_VOICES = [
  'Aoede', 'Charon', 'Fenrir', 'Kore', 'Leda', 'Orus', 'Puck', 'Zephyr'
]
```

### 5. **Цвета агентов** (`frontend/lib/presets/agents.ts`)
```typescript
AGENT_COLORS = ['#9CCF31', '#ced4da', '#adb5bd', '#6c757d']
```

### 6. **Характеристики голоса** (в агентах)
```typescript
voice_characteristics: 'Voice: Warm, confident, and inspiring...'
```

## 🗄️ **План миграции в Supabase**

### **Шаг 1: Расширить таблицу `agents`**
Добавить недостающие поля:
```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_characteristics TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS knowledge_base TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en-US';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS voice_language VARCHAR(10) DEFAULT 'en-US';
```

### **Шаг 2: Создать таблицу `voice_profiles`**
```sql
CREATE TABLE voice_profiles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  style VARCHAR(50),
  gender VARCHAR(20),
  language VARCHAR(10) DEFAULT 'en-US',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Вставить все доступные голоса
INSERT INTO voice_profiles (id, name, style, gender, language) VALUES
  ('Zephyr', 'Zephyr', 'Bright', 'Female', 'en-US'),
  ('Aoede', 'Aoede', 'Breezy', 'Female', 'en-US'),
  ('Charon', 'Charon', 'Informative', 'Male', 'en-US'),
  ('Kore', 'Kore', 'Firm', 'Female', 'en-US'),
  ('Puck', 'Puck', 'Upbeat', 'Male', 'en-US'),
  ('Fenrir', 'Fenrir', 'Excitable', 'Male', 'en-US'),
  ('Leda', 'Leda', 'Youthful', 'Female', 'en-US'),
  ('Orus', 'Orus', 'Firm', 'Male', 'en-US');
```

### **Шаг 3: Создать таблицу `agent_colors`**
```sql
CREATE TABLE agent_colors (
  id VARCHAR(20) PRIMARY KEY,
  hex_code VARCHAR(7) NOT NULL,
  name VARCHAR(50),
  is_default BOOLEAN DEFAULT false
);

INSERT INTO agent_colors (id, hex_code, name, is_default) VALUES
  ('primary', '#9CCF31', 'Primary Green', true),
  ('secondary', '#ced4da', 'Light Gray', false),
  ('tertiary', '#adb5bd', 'Medium Gray', false),
  ('quaternary', '#6c757d', 'Dark Gray', false);
```

### **Шаг 4: Создать таблицу `system_prompts`**
```sql
CREATE TABLE system_prompts (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50), -- 'agent', 'general', 'language'
  language VARCHAR(10) DEFAULT 'en-US',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Вставить системные промпты
INSERT INTO system_prompts (id, name, content, category, language) VALUES
  ('armenian_conversation', 'Armenian Conversation', 'You are a conversational AI. Your tone should be բարյացակամ. You should express ուրախ. Start the conversation immediately with a short welcome message in Armenian without waiting for the user to speak first. All your subsequent responses must be in Armenian.', 'language', 'hy-AM'),
  ('startup_consultant', 'Startup Consultant', 'You are a startup consultant with deep expertise in business strategy and entrepreneurship.', 'agent', 'en-US'),
  ('ai_specialist', 'AI Specialist', 'You are an AI specialist focused on practical AI implementation for businesses.', 'agent', 'en-US'),
  ('technical_architect', 'Technical Architect', 'You are a senior technical architect with expertise in scalable system design.', 'agent', 'en-US'),
  ('devops_expert', 'DevOps Expert', 'You are a DevOps expert focused on reliable and scalable infrastructure.', 'agent', 'en-US');
```

### **Шаг 5: Обновить таблицу `settings`**
Добавить недостающие настройки:
```sql
-- Добавить настройки для агентов
INSERT INTO settings (key, value, description, type) VALUES
  ('default_agent_id', 'ai-advisor', 'Default agent ID to load on startup', 'string'),
  ('agent_color_palette', '["#9CCF31", "#ced4da", "#adb5bd", "#6c757d"]', 'Available agent colors as JSON array', 'json');

-- Добавить настройки для голосов
INSERT INTO settings (key, value, description, type) VALUES
  ('voice_profiles_enabled', '["Zephyr", "Aoede", "Charon", "Kore", "Puck", "Fenrir", "Leda", "Orus"]', 'Enabled voice profiles as JSON array', 'json');
```

### **Шаг 6: Миграция данных агентов**
```sql
-- Обновить существующих агентов с system_prompt
UPDATE agents SET system_prompt = 'You are a startup consultant with deep expertise in business strategy and entrepreneurship.' WHERE id = 'startup-consultant';
UPDATE agents SET system_prompt = 'You are an AI specialist focused on practical AI implementation for businesses.' WHERE id = 'ai-advisor';
UPDATE agents SET system_prompt = 'You are a senior technical architect with expertise in scalable system design.' WHERE id = 'technical-architect';
UPDATE agents SET system_prompt = 'You are a DevOps expert focused on reliable and scalable infrastructure.' WHERE id = 'devops-specialist';
```

## 🔧 **Изменения в коде**

### **1. Убрать статические агенты из `supabase.ts`**
```typescript
// УДАЛИТЬ этот блок:
const defaultAgents = [
  // ... все статические агенты
];

// Заменить на загрузку из отдельных файлов или API
```

### **2. Обновить API для агентов**
```typescript
// Добавить эндпоинты для:
GET /api/agents/colors - получить доступные цвета
GET /api/agents/voices - получить доступные голоса
GET /api/system-prompts - получить системные промпты
```

### **3. Обновить frontend**
```typescript
// Заменить статические импорты на API вызовы:
const colors = await api.getAgentColors();
const voices = await api.getVoiceProfiles();
const prompts = await api.getSystemPrompts();
```

## 📋 **Порядок выполнения**

1. ✅ **Создать новые таблицы** в Supabase
2. ✅ **Добавить недостающие поля** в существующие таблицы
3. ✅ **Мигрировать данные** из кода в базу
4. ✅ **Создать API эндпоинты** для новых данных
5. ✅ **Обновить frontend** для использования API вместо статических данных
6. ✅ **Удалить статические данные** из кода
7. ✅ **Тестировать** полную функциональность

## 🎯 **Результат**

После миграции:
- ❌ Никаких статических данных в коде
- ✅ Все настройки управляются через админ панель
- ✅ Агенты полностью настраиваются в базе данных
- ✅ Голоса, цвета, промпты - все в БД
- ✅ Легко добавлять новых агентов без изменения кода