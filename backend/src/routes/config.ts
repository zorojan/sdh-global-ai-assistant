import express from 'express';
import { supabase } from '../database/supabase';

const router = express.Router();

// 🎯 ГЛАВНЫЙ ENDPOINT - Получить полную конфигурацию для ai.live.connect()
router.get('/live-connection/:agentId', async (req: any, res: express.Response) => {
  try {
    const { agentId } = req.params;

    // 1. НАСТРОЙКИ АГЕНТА (Agent-specific settings)
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('is_active', true)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // 2. ОБЩИЕ НАСТРОЙКИ (Global settings)
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', [
        'gemini_live_model',
        'gemini_live_response_modalities', 
        'gemini_live_input_transcription',
        'gemini_live_output_transcription',
        'default_system_instruction_prefix'
      ]);

    if (settingsError) {
      console.error('Settings error:', settingsError);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }

    // Преобразовать настройки в объект
    const settingsObj: any = {};
    settings?.forEach((setting: any) => {
      let value = setting.value;
      // Парсим JSON значения
      if (setting.key === 'gemini_live_response_modalities') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          value = ['AUDIO']; // fallback
        }
      }
      // Парсим boolean значения
      if (setting.key.includes('transcription')) {
        value = value === 'true';
      }
      settingsObj[setting.key] = value;
    });

    // 3. СОЗДАТЬ ПОЛНУЮ КОНФИГУРАЦИЮ для ai.live.connect()
    const connectionConfig = {
      // Модель
      model: settingsObj.gemini_live_model || 'gemini-2.5-flash-native-audio-preview-09-2025',

      // Главная конфигурация
      config: {
        // Модальности ответа
        responseModalities: settingsObj.gemini_live_response_modalities || ['AUDIO'],

        // Конфигурация речи
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: agent.voice || 'Orus'
            }
          }
        },

        // Транскрипции (если включены)
        ...(settingsObj.gemini_live_input_transcription && {
          inputAudioTranscription: {}
        }),
        ...(settingsObj.gemini_live_output_transcription && {
          outputAudioTranscription: {}
        }),

        // Системные инструкции
        systemInstruction: buildSystemInstruction(agent, settingsObj.default_system_instruction_prefix)
      }
    };

    // 4. ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ ОБ АГЕНТЕ
    const agentInfo = {
      id: agent.id,
      name: agent.name,
      personality: agent.personality,
      language: agent.language,
      voice_language: agent.voice_language,
      voice_characteristics: agent.voice_characteristics
    };

    res.json({
      connectionConfig,
      agentInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Live connection config error:', error);
    res.status(500).json({ error: 'Failed to build Live API configuration' });
  }
});

// 🛠️ ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ - Построить systemInstruction
function buildSystemInstruction(agent: any, defaultPrefix: string): string {
  const baseInstruction = agent.system_prompt || agent.personality || 'You are a helpful AI assistant.';
  const prefix = defaultPrefix || 'You are a conversational AI. Your tone should be բարյացակամ. You should express ուրախ.';
  
  // Определить язык для инструкций
  const language = agent.language || agent.voice_language || 'hy-AM';
  let languageInstruction = '';
  
  switch (language) {
    case 'hy-AM':
      languageInstruction = 'Start the conversation immediately with a short welcome message in Armenian without waiting for the user to speak first. All your subsequent responses must be in Armenian.';
      break;
    case 'ru-RU':
      languageInstruction = 'Start the conversation immediately with a short welcome message in Russian without waiting for the user to speak first. All your subsequent responses must be in Russian.';
      break;
    case 'en-US':
    default:
      languageInstruction = 'Start the conversation immediately with a short welcome message in English without waiting for the user to speak first. All your subsequent responses must be in English.';
      break;
  }

  return `${prefix} ${baseInstruction} ${languageInstruction}`;
}

// 📋 ДОПОЛНИТЕЛЬНЫЕ ENDPOINTS

// Получить список всех доступных голосов
router.get('/voices', async (req: any, res: express.Response) => {
  try {
    const { data: voices, error } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    res.json(voices || []);
  } catch (error) {
    console.error('Get voices error:', error);
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// Получить настройки Live API
router.get('/live-settings', async (req: any, res: express.Response) => {
  try {
    const { data: settings, error } = await supabase
      .from('settings')
      .select('key, value, description')
      .like('key', 'gemini_live_%');

    if (error) throw error;

    const settingsObj: any = {};
    settings?.forEach((setting: any) => {
      settingsObj[setting.key] = {
        value: setting.value,
        description: setting.description
      };
    });

    res.json(settingsObj);
  } catch (error) {
    console.error('Get live settings error:', error);
    res.status(500).json({ error: 'Failed to fetch Live API settings' });
  }
});

// Обновить настройки Live API (admin only)
router.put('/live-settings/:key', async (req: any, res: express.Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Проверить, что это валидный ключ настройки Live API
    if (!key.startsWith('gemini_live_') && !key.startsWith('default_')) {
      return res.status(400).json({ error: 'Invalid settings key' });
    }

    const { error } = await supabase
      .from('settings')
      .update({ value })
      .eq('key', key);

    if (error) throw error;

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;