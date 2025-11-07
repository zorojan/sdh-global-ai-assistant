-- ✅ СИНХРОНИЗАЦИЯ ГОЛОСОВ - Обновление всех официальных голосов Gemini Live API

-- Удалить старые голоса, которых нет в официальном списке
DELETE FROM voice_profiles WHERE name NOT IN (
  'Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir', 'Orus', 'Aoede', 'Callirrhoe',
  'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina',
  'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam',
  'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix',
  'Sadachbia', 'Sadaltager', 'Sulafat'
);

-- Вставить или обновить все 30 официальных голосов
INSERT INTO voice_profiles (name, style, gender, language, provider, is_active) VALUES
-- Основные рекомендуемые голоса
('Zephyr', 'Bright', 'Female', 'en-US', 'gemini', true),
('Kore', 'Firm', 'Female', 'en-US', 'gemini', true),
('Orus', 'Firm', 'Male', 'en-US', 'gemini', true),
('Aoede', 'Breezy', 'Female', 'en-US', 'gemini', true),
('Charon', 'Informative', 'Male', 'en-US', 'gemini', true),

-- Дополнительные голоса
('Puck', 'Upbeat', 'Male', 'en-US', 'gemini', true),
('Fenrir', 'Excitable', 'Male', 'en-US', 'gemini', true),
('Callirrhoe', 'Easy-going', 'Female', 'en-US', 'gemini', true),
('Autonoe', 'Bright', 'Female', 'en-US', 'gemini', true),
('Enceladus', 'Breathy', 'Male', 'en-US', 'gemini', true),
('Iapetus', 'Clear', 'Male', 'en-US', 'gemini', true),
('Umbriel', 'Easy-going', 'Male', 'en-US', 'gemini', true),
('Algieba', 'Smooth', 'Female', 'en-US', 'gemini', true),
('Despina', 'Smooth', 'Female', 'en-US', 'gemini', true),
('Erinome', 'Clear', 'Female', 'en-US', 'gemini', true),
('Algenib', 'Gravelly', 'Male', 'en-US', 'gemini', true),
('Rasalgethi', 'Informative', 'Male', 'en-US', 'gemini', true),
('Laomedeia', 'Upbeat', 'Female', 'en-US', 'gemini', true),
('Achernar', 'Soft', 'Male', 'en-US', 'gemini', true),
('Alnilam', 'Firm', 'Male', 'en-US', 'gemini', true),
('Schedar', 'Even', 'Female', 'en-US', 'gemini', true),
('Gacrux', 'Mature', 'Male', 'en-US', 'gemini', true),
('Pulcherrima', 'Forward', 'Female', 'en-US', 'gemini', true),
('Achird', 'Friendly', 'Male', 'en-US', 'gemini', true),
('Zubenelgenubi', 'Casual', 'Male', 'en-US', 'gemini', true),
('Vindemiatrix', 'Gentle', 'Female', 'en-US', 'gemini', true),
('Sadachbia', 'Lively', 'Male', 'en-US', 'gemini', true),
('Sadaltager', 'Knowledgeable', 'Male', 'en-US', 'gemini', true),
('Sulafat', 'Warm', 'Female', 'en-US', 'gemini', true),

-- Дополнительные голоса (остальные из списка 30)
('Leda', 'Youthful', 'Female', 'en-US', 'gemini', true)

ON CONFLICT (name) DO UPDATE SET
  style = EXCLUDED.style,
  gender = EXCLUDED.gender,
  language = EXCLUDED.language,
  provider = EXCLUDED.provider,
  is_active = EXCLUDED.is_active;

-- Добавить настройки для Gemini Live API в settings таблицу
INSERT INTO settings (key, value, description, type) VALUES 
-- ОБЩИЕ НАСТРОЙКИ (Global Settings)
('gemini_live_model', 'gemini-2.5-flash-native-audio-preview-09-2025', 'Модель для Gemini Live API', 'string'),
('gemini_live_response_modalities', '["AUDIO"]', 'Модальности ответа для Live API', 'json'),
('gemini_live_input_transcription', 'true', 'Включить транскрипцию входящего аудио', 'boolean'),
('gemini_live_output_transcription', 'true', 'Включить транскрипцию исходящего аудио', 'boolean'),

-- НАСТРОЙКИ АГЕНТОВ ПО УМОЛЧАНИЮ (Default Agent Settings)
('default_voice_name', 'Orus', 'Голос по умолчанию для новых агентов', 'string'),
('default_language', 'hy-AM', 'Язык по умолчанию для агентов', 'string'),
('default_system_instruction_prefix', 'You are a conversational AI. Your tone should be բարյացակամ. You should express ուրախ.', 'Префикс системных инструкций', 'text')

ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  type = EXCLUDED.type;

-- Обновить существующих агентов на правильные голоса из базы
UPDATE agents SET voice = 'Orus' WHERE voice = 'Aoede' OR voice NOT IN (
  SELECT name FROM voice_profiles WHERE is_active = true
);

UPDATE agents SET voice = 'Zephyr' WHERE id = 'cba-helper';
UPDATE agents SET voice = 'Charon' WHERE id = 'technical-architect';

-- Проверить результат
SELECT 'ГОЛОСА В БАЗЕ:' as info, COUNT(*) as count FROM voice_profiles WHERE is_active = true;
SELECT 'НАСТРОЙКИ LIVE API:' as info, COUNT(*) as count FROM settings WHERE key LIKE 'gemini_live_%';
SELECT 'АГЕНТЫ С ВАЛИДНЫМИ ГОЛОСАМИ:' as info, COUNT(*) as count FROM agents 
WHERE voice IN (SELECT name FROM voice_profiles WHERE is_active = true);

COMMIT;