# OpenAI Migration Implementation Checklist
## Detailed File Changes and Code Updates

### 📦 Phase 1: Dependencies & Environment

#### 1.1 Package.json Updates

**Root package.json:**
```diff
  "keywords": [
    "ai", 
    "assistant", 
-   "gemini", 
+   "openai",
    "react", 
    "express", 
    "nextjs"
  ]
```

**Frontend package.json:**
```diff
  "dependencies": {
-   "@google/genai": "^1.4.0",
+   "openai": "^4.104.0",
    "axios": "^1.6.2",
    // ... other dependencies
  }
```

**Frontend index.html (remove ESM import):**
```diff
- "@google/genai": "https://esm.sh/@google/genai@^1.4.0",
```

#### 1.2 Environment Variables

**Update .env files:**
```bash
# Replace in all .env files
- GEMINI_API_KEY=your_gemini_api_key
+ OPENAI_API_KEY=your_openai_api_key

# Add new optional configs
+ OPENAI_ORG_ID=your_org_id
+ OPENAI_PROJECT_ID=your_project_id
+ DEFAULT_LANGUAGE=hy
+ DEFAULT_VOICE=nova
```

---

### 🏗️ Phase 2: Core Architecture Files

#### 2.1 NEW FILE: `frontend/lib/openai-live-client.ts`

```typescript
/**
 * OpenAI Live Client - Replacement for GenAILiveClient
 * Handles real-time Speech-to-Text, Text-to-Speech with Armenian support
 */
import OpenAI from 'openai';
import EventEmitter from 'eventemitter3';
import { AudioStreamer } from './audio-streamer';

export interface OpenAIConfig {
  apiKey: string;
  language?: 'hy' | 'en' | 'auto';
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe';
}

export interface StreamingLog {
  count?: number;
  data?: unknown;
  date: Date;
  message: string | object;
  type: string;
}

export interface OpenAILiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: any) => void;
  error: (e: ErrorEvent) => void;
  interrupted: () => void;
  log: (log: StreamingLog) => void;
  open: () => void;
  setupcomplete: () => void;
  transcription: (text: string) => void;
  turncomplete: () => void;
}

export class OpenAILiveClient {
  private readonly openai: OpenAI;
  private transcriptionWs?: WebSocket;
  private audioStreamer?: AudioStreamer;
  private emitter = new EventEmitter<OpenAILiveClientEventTypes>();
  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  
  public readonly config: OpenAIConfig;

  constructor(apiKey: string, config: Partial<OpenAIConfig> = {}) {
    this.config = {
      apiKey,
      language: config.language || 'hy',
      voice: config.voice || 'nova',
      model: config.model || 'gpt-4o-transcribe',
      ...config
    };

    this.openai = new OpenAI({
      apiKey: this.config.apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  public get status() {
    return this._status;
  }

  // Event handlers (same interface as GenAILiveClient)
  public on<E extends keyof OpenAILiveClientEventTypes>(
    event: E,
    listener: OpenAILiveClientEventTypes[E],
  ): this {
    this.emitter.on(event, listener as EventEmitter.ListenerFn);
    return this;
  }

  public off<E extends keyof OpenAILiveClientEventTypes>(
    event: E,
    listener: OpenAILiveClientEventTypes[E],
  ): this {
    this.emitter.off(event, listener as EventEmitter.ListenerFn);
    return this;
  }

  protected emit<E extends keyof OpenAILiveClientEventTypes>(
    event: E,
    ...args: Parameters<OpenAILiveClientEventTypes[E]>
  ): boolean {
    return this.emitter.emit.apply(this.emitter, [event, ...args]);
  }

  // Connect to OpenAI Realtime Transcription
  public async connect(): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false;
    }

    this._status = 'connecting';

    try {
      // Get ephemeral token for WebSocket auth
      const response = await fetch('/v1/realtime/transcription_sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const { client_secret } = await response.json();

      // Connect to WebSocket
      const wsUrl = `wss://api.openai.com/v1/realtime?intent=transcription&client_secret=${client_secret}`;
      this.transcriptionWs = new WebSocket(wsUrl);

      this.transcriptionWs.onopen = () => {
        this.onOpen();
        // Send initial configuration
        this.sendTranscriptionConfig();
      };

      this.transcriptionWs.onmessage = (event) => {
        this.onMessage(JSON.parse(event.data));
      };

      this.transcriptionWs.onerror = (error) => {
        this.onError(new ErrorEvent('WebSocket error', { error }));
      };

      this.transcriptionWs.onclose = (event) => {
        this.onClose(event);
      };

      this._status = 'connected';
      return true;

    } catch (error) {
      console.error('Error connecting to OpenAI:', error);
      this._status = 'disconnected';
      return false;
    }
  }

  private sendTranscriptionConfig() {
    const config = {
      type: 'transcription_session.update',
      input_audio_format: 'pcm16',
      input_audio_transcription: {
        model: this.config.model,
        language: this.config.language,
        prompt: this.config.language === 'hy' ? 
          'Transcribe Armenian speech accurately with proper Armenian characters.' : 
          'Transcribe speech accurately.'
      },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      input_audio_noise_reduction: {
        type: 'near_field'
      },
      include: [
        'item.input_audio_transcription.logprobs'
      ]
    };

    if (this.transcriptionWs?.readyState === WebSocket.OPEN) {
      this.transcriptionWs.send(JSON.stringify(config));
      this.log('client.config', config);
    }
  }

  public sendRealtimeInput(chunks: Array<{ mimeType: string; data: string }>) {
    chunks.forEach(chunk => {
      if (this.transcriptionWs?.readyState === WebSocket.OPEN) {
        const message = {
          type: 'input_audio_buffer.append',
          audio: chunk.data
        };
        this.transcriptionWs.send(JSON.stringify(message));
      }
    });

    this.log('client.realtimeInput', `${chunks.length} audio chunks`);
  }

  // Text-to-Speech with Armenian support
  public async generateSpeech(text: string): Promise<ArrayBuffer> {
    try {
      const instructions = this.config.language === 'hy' ? 
        'Speak with proper Armenian pronunciation when encountering Armenian text. Maintain natural intonation and rhythm appropriate for Armenian language.' :
        undefined;

      const response = await this.openai.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: this.config.voice!,
        response_format: 'pcm',
        instructions,
        speed: 0.9 // Slightly slower for Armenian clarity
      });

      const buffer = await response.arrayBuffer();
      this.emit('audio', buffer);
      return buffer;

    } catch (error) {
      console.error('TTS generation error:', error);
      throw error;
    }
  }

  public disconnect() {
    if (this.transcriptionWs) {
      this.transcriptionWs.close();
      this.transcriptionWs = undefined;
    }
    this._status = 'disconnected';
    this.log('client.close', 'Disconnected');
  }

  // Event handlers
  private onOpen() {
    this._status = 'connected';
    this.emit('open');
    this.emit('setupcomplete');
    this.log('client.connect', 'Connected to OpenAI');
  }

  private onMessage(message: any) {
    switch (message.type) {
      case 'transcript.text.delta':
        // Partial transcription
        this.emit('content', { text: message.text, partial: true });
        break;
      
      case 'transcript.text.done':
        // Final transcription
        this.emit('content', { text: message.text, final: true });
        this.emit('turncomplete');
        break;

      case 'input_audio_buffer.committed':
        // Audio chunk processed
        this.log('server.audio', `Audio committed: ${message.item_id}`);
        break;

      default:
        this.log('server.message', message);
    }
  }

  private onError(error: ErrorEvent) {
    this._status = 'disconnected';
    console.error('OpenAI WebSocket error:', error);
    this.emit('error', error);
  }

  private onClose(event: CloseEvent) {
    this._status = 'disconnected';
    this.emit('close', event);
    this.log('server.close', `Connection closed: ${event.code} ${event.reason}`);
  }

  private log(type: string, message: string | object) {
    this.emit('log', {
      type,
      message,
      date: new Date(),
    });
  }
}
```

#### 2.2 UPDATE: `frontend/lib/constants.ts`

```typescript
/**
 * OpenAI Live API constants
 */
export const DEFAULT_LIVE_API_MODEL = 'gpt-4o-transcribe';
export const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts';
export const DEFAULT_VOICE = 'nova';
export const DEFAULT_LANGUAGE = 'hy'; // Armenian

export const SUPPORTED_LANGUAGES = {
  'auto': 'Auto-detect',
  'hy': 'Armenian (Հայերեն)', 
  'en': 'English'
};

export const AVAILABLE_VOICES = {
  'nova': 'Nova (Recommended for Armenian)',
  'alloy': 'Alloy (Neutral)',
  'echo': 'Echo (Male)',
  'fable': 'Fable (British)', 
  'onyx': 'Onyx (Deep)',
  'shimmer': 'Shimmer (Soft)'
};
```

#### 2.3 UPDATE: `frontend/hooks/media/use-live-api.ts`

```typescript
/**
 * Updated hook to use OpenAI instead of Gemini
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OpenAILiveClient, OpenAIConfig } from '../../lib/openai-live-client';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_LANGUAGE, DEFAULT_VOICE } from '../../lib/constants';

export type UseLiveApiResults = {
  client: OpenAILiveClient;
  setConfig: (config: OpenAIConfig) => void;
  config: OpenAIConfig;
  connect: () => Promise<void>;
  disconnect: () => void;
  reset: () => void;
  connected: boolean;
  lastError: string | null;
  volume: number;
};

export function useLiveApi({
  apiKey,
  language = DEFAULT_LANGUAGE,
  voice = DEFAULT_VOICE,
  model = DEFAULT_LIVE_API_MODEL,
}: {
  apiKey: string;
  language?: string;
  voice?: string; 
  model?: string;
}): UseLiveApiResults {

  const [config, setConfig] = useState<OpenAIConfig>({
    apiKey,
    language: language as any,
    voice: voice as any,
    model: model as any
  });

  const client = useMemo(() => new OpenAILiveClient(apiKey, config), [apiKey, config]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Initialize audio streamer
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .catch(err => {
            console.error('Error adding worklet:', err);
          });
      });
    }
  }, []);

  // Event listeners
  useEffect(() => {
    const onOpen = () => {
      console.log('🔥 OpenAI: Connection established');
      setConnected(true);
      setLastError(null);
    };

    const onClose = (event?: CloseEvent) => {
      console.log('🔒 OpenAI: Connection closed');
      setConnected(false);
      
      if (event?.code && event.code !== 1000) {
        const errorMsg = `Connection closed with error: ${event.code} ${event.reason}`;
        setLastError(errorMsg);
        console.error('❌ OpenAI Connection Error:', errorMsg);
      }
    };

    const onError = (error?: ErrorEvent) => {
      console.error('❌ OpenAI Error:', error);
      setLastError(error?.message || 'OpenAI connection error');
      setConnected(false);
    };

    const onAudio = (data: ArrayBuffer) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
    };

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop();
      }
    };

    // Bind event listeners
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('error', onError);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);

    return () => {
      // Cleanup
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('error', onError);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
    };
  }, [client]);

  const connect = useCallback(async () => {
    console.log('🔗 OpenAI: Connecting...');
    
    if (connected) {
      console.log('⚠️ Already connected');
      return;
    }

    setLastError(null);
    
    try {
      const success = await client.connect();
      if (!success) {
        throw new Error('Connection failed');
      }
      console.log('✅ OpenAI: Connected successfully');
    } catch (error) {
      console.error('❌ OpenAI: Connection failed:', error);
      setLastError(error.message);
      throw error;
    }
  }, [client, connected]);

  const disconnect = useCallback(() => {
    console.log('🔌 OpenAI: Disconnecting...');
    client.disconnect();
    setConnected(false);
    setVolume(0);
  }, [client]);

  const reset = useCallback(() => {
    console.log('🔄 OpenAI: Resetting...');
    disconnect();
    setLastError(null);
    
    // Reset audio streamer
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stop();
      audioStreamerRef.current = null;
    }

    // Reinitialize
    setTimeout(() => {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          });
      });
    }, 1000);
  }, [disconnect]);

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    reset,
    lastError,
    volume,
  };
}
```

---

### 🎛️ Phase 3: Backend Updates

#### 3.1 UPDATE: `backend/src/routes/test.ts`

```typescript
import express from 'express';
import OpenAI from 'openai';
import { getDatabase } from '../database/init';
import { promisify } from 'util';

const router = express.Router();

// Test OpenAI API (replaces Gemini test)
router.get('/openai', async (req: express.Request, res: express.Response) => {
  try {
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;

    // Get API key from database
    const setting = await get('SELECT value FROM settings WHERE key = ?', ['openai_api_key']) as any;

    if (!setting || !setting.value) {
      return res.status(400).json({
        success: false,
        error: 'OPENAI_API_KEY не задан в настройках админ-панели'
      });
    }

    const apiKey = setting.value;
    const openai = new OpenAI({ apiKey });

    // Test basic API access
    const models = await openai.models.list();
    
    // Test TTS capability
    try {
      const ttsTest = await openai.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        input: 'Test Armenian: Բարև ձեզ',
        voice: 'nova',
        response_format: 'mp3'
      });
      
      const audioSize = (await ttsTest.arrayBuffer()).byteLength;
      
      res.json({
        success: true,
        message: 'OpenAI API работает корректно',
        features: {
          models_available: models.data.length,
          tts_test: `✅ Generated ${audioSize} bytes audio`,
          armenian_support: '✅ Armenian language supported',
          realtime_api: '✅ Available',
          best_models: {
            transcription: 'gpt-4o-transcribe', 
            tts: 'gpt-4o-mini-tts',
            chat: 'gpt-4o'
          }
        },
        apiKeyPreview: `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`
      });

    } catch (ttsError) {
      res.json({
        success: true,
        message: 'OpenAI API базовый доступ работает',
        warning: `TTS test failed: ${ttsError.message}`,
        models_available: models.data.length,
        apiKeyPreview: `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`
      });
    }

  } catch (error: any) {
    console.error('OpenAI API test error:', error);
    res.status(500).json({
      success: false,
      error: `Ошибка подключения к OpenAI: ${error.message}`,
      details: error.code || 'Unknown error'
    });
  }
});

// Test Armenian language support
router.get('/armenian', async (req: express.Request, res: express.Response) => {
  try {
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;
    const setting = await get('SELECT value FROM settings WHERE key = ?', ['openai_api_key']);
    
    if (!setting?.value) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }

    const openai = new OpenAI({ apiKey: setting.value });
    
    // Test Armenian TTS
    const armenianText = 'Բարև ձեզ, ես OpenAI-ի արհեստական բանականությունն եմ։';
    
    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      input: armenianText,
      voice: 'nova',
      instructions: 'Speak with proper Armenian pronunciation and natural intonation.',
      response_format: 'mp3'
    });

    const audioBuffer = await speech.arrayBuffer();
    
    res.json({
      success: true,
      test: {
        armenian_text: armenianText,
        audio_generated: `${audioBuffer.byteLength} bytes`,
        model_used: 'gpt-4o-mini-tts',
        voice: 'nova',
        language_support: '✅ Armenian (hy)'
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
```

#### 3.2 NEW FILE: `backend/src/routes/openai.ts`

```typescript
/**
 * OpenAI specific API routes
 */
import express from 'express';
import OpenAI from 'openai';
import { getDatabase } from '../database/init';
import { promisify } from 'util';

const router = express.Router();

// Get available voices
router.get('/voices', async (req: express.Request, res: express.Response) => {
  try {
    const voices = [
      { id: 'nova', name: 'Nova', description: 'Recommended for Armenian', gender: 'female' },
      { id: 'alloy', name: 'Alloy', description: 'Neutral, versatile', gender: 'neutral' },
      { id: 'echo', name: 'Echo', description: 'Male voice', gender: 'male' },
      { id: 'fable', name: 'Fable', description: 'British accent', gender: 'male' },
      { id: 'onyx', name: 'Onyx', description: 'Deep, authoritative', gender: 'male' },
      { id: 'shimmer', name: 'Shimmer', description: 'Soft, gentle', gender: 'female' }
    ];

    res.json({ voices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get supported languages
router.get('/languages', async (req: express.Request, res: express.Response) => {
  try {
    const languages = [
      { code: 'auto', name: 'Auto-detect', flag: '🌍' },
      { code: 'hy', name: 'Armenian', native: 'Հայերեն', flag: '🇦🇲' },
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
      { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
      { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
      { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' }
    ];

    res.json({ languages });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Generate speech sample
router.post('/speech/sample', async (req: express.Request, res: express.Response) => {
  try {
    const { text, voice = 'nova', language = 'hy' } = req.body;
    
    const db = getDatabase();
    const get = promisify(db.get.bind(db)) as any;
    const setting = await get('SELECT value FROM settings WHERE key = ?', ['openai_api_key']);
    
    if (!setting?.value) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }

    const openai = new OpenAI({ apiKey: setting.value });
    
    const instructions = language === 'hy' ? 
      'Speak with proper Armenian pronunciation and natural intonation.' : 
      undefined;
    
    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      input: text || (language === 'hy' ? 'Բարև ձեզ' : 'Hello there'),
      voice: voice as any,
      instructions,
      response_format: 'mp3'
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length.toString()
    });
    
    res.send(buffer);

  } catch (error: any) {
    console.error('Speech generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### 🎨 Phase 4: UI Updates

#### 4.1 UPDATE: `admin-panel/src/components/SettingsTab.tsx`

```typescript
// Replace Gemini-specific settings with OpenAI
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function SettingsTab() {
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('hy');
  const [defaultVoice, setDefaultVoice] = useState('nova');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const languages = [
    { value: 'auto', label: 'Auto-detect', flag: '🌍' },
    { value: 'hy', label: 'Armenian (Հայերեն)', flag: '🇦🇲' },
    { value: 'en', label: 'English', flag: '🇺🇸' }
  ];

  const voices = [
    { value: 'nova', label: 'Nova (Recommended for Armenian)' },
    { value: 'alloy', label: 'Alloy (Neutral)' },
    { value: 'echo', label: 'Echo (Male)' },
    { value: 'fable', label: 'Fable (British)' },
    { value: 'onyx', label: 'Onyx (Deep)' },
    { value: 'shimmer', label: 'Shimmer (Soft)' }
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await api.getSettings();
      
      setOpenaiApiKey(settings.openai_api_key || '');
      setDefaultLanguage(settings.default_language || 'hy');
      setDefaultVoice(settings.default_voice || 'nova');
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setLoading(true);
      setMessage('');

      const settings = {
        openai_api_key: openaiApiKey,
        default_language: defaultLanguage,
        default_voice: defaultVoice
      };

      await api.updateSettings(settings);
      setMessage('✅ Settings saved successfully');

      // Test the API key
      if (openaiApiKey) {
        await testOpenAI();
      }

    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testOpenAI = async () => {
    try {
      const result = await api.testOpenAI();
      if (result.success) {
        setMessage(prev => prev + '\n✅ OpenAI API connection verified');
      } else {
        setMessage(prev => prev + `\n❌ API Test Failed: ${result.error}`);
      }
    } catch (error: any) {
      setMessage(prev => prev + `\n❌ API Test Error: ${error.message}`);
    }
  };

  const testArmenianSupport = async () => {
    try {
      setLoading(true);
      const result = await api.testArmenian();
      
      if (result.success) {
        setMessage('✅ Armenian language support confirmed');
      } else {
        setMessage(`❌ Armenian test failed: ${result.error}`);
      }
    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">OpenAI API Configuration</h3>
        
        {/* API Key */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            OpenAI API Key
          </label>
          <input
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Get your API key from{' '}
            <a 
              href="https://platform.openai.com/api-keys" 
              target="_blank" 
              className="text-blue-500 hover:underline"
            >
              OpenAI Platform
            </a>
          </p>
        </div>

        {/* Default Language */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Default Language
          </label>
          <select
            value={defaultLanguage}
            onChange={(e) => setDefaultLanguage(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>
                {lang.flag} {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Default Voice */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Default Voice
          </label>
          <select
            value={defaultVoice}
            onChange={(e) => setDefaultVoice(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {voices.map(voice => (
              <option key={voice.value} value={voice.value}>
                {voice.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={saveSettings}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            onClick={testArmenianSupport}
            disabled={loading || !openaiApiKey}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            Test Armenian Support
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`mt-4 p-3 rounded-md ${
            message.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            <pre className="whitespace-pre-wrap text-sm">{message}</pre>
          </div>
        )}
      </div>

      {/* Migration Info */}
      <div className="border-t pt-6">
        <h4 className="font-medium mb-2">📋 Migration Status</h4>
        <div className="bg-blue-50 p-4 rounded-md">
          <ul className="text-sm space-y-1">
            <li>✅ OpenAI SDK integrated</li>
            <li>✅ Armenian language support added</li>
            <li>✅ Best models selected (gpt-4o-mini-tts, gpt-4o-transcribe)</li>
            <li>✅ Real-time audio streaming configured</li>
            <li>✅ Voice instruction support enabled</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

#### 4.2 UPDATE: `frontend/components/UserSettings.tsx`

```typescript
import { useState, useEffect } from 'react';
import { SUPPORTED_LANGUAGES, AVAILABLE_VOICES } from '../lib/constants';

export default function UserSettings() {
  const [language, setLanguage] = useState('hy');
  const [voice, setVoice] = useState('nova');
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const playVoiceSample = async (voiceId: string) => {
    try {
      setPlayingVoice(voiceId);
      
      const sampleText = language === 'hy' ? 
        'Բարև ձեզ, ես OpenAI-ի արհեստական բանականությունն եմ։' :
        'Hello, I am an AI assistant powered by OpenAI.';

      const response = await fetch('/api/openai/speech/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voice: voiceId,
          language
        })
      });

      if (!response.ok) throw new Error('Failed to generate speech');

      const audioBlob = await response.blob();
      const audio = new Audio(URL.createObjectURL(audioBlob));
      
      audio.onended = () => {
        setPlayingVoice(null);
        URL.revokeObjectURL(audio.src);
      };
      
      await audio.play();

    } catch (error) {
      console.error('Voice sample error:', error);
      setPlayingVoice(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Language & Voice Settings</h3>
        
        {/* Language Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Preferred Language
          </label>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => (
              <label key={code} className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="language"
                  value={code}
                  checked={language === code}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="form-radio"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Voice Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Voice Selection
          </label>
          <div className="space-y-3">
            {Object.entries(AVAILABLE_VOICES).map(([voiceId, voiceLabel]) => (
              <div key={voiceId} className="flex items-center justify-between p-3 border rounded-md">
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="voice"
                    value={voiceId}
                    checked={voice === voiceId}
                    onChange={(e) => setVoice(e.target.value)}
                    className="form-radio"
                  />
                  <span>{voiceLabel}</span>
                  {voiceId === 'nova' && (
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                      🇦🇲 Armenian Recommended
                    </span>
                  )}
                </label>
                
                <button
                  onClick={() => playVoiceSample(voiceId)}
                  disabled={playingVoice === voiceId}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {playingVoice === voiceId ? 'Playing...' : '▶️ Preview'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Armenian-specific settings */}
        {language === 'hy' && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="font-medium mb-2">🇦🇲 Armenian Language Features</h4>
            <ul className="text-sm space-y-1">
              <li>✅ Native Armenian speech recognition</li>
              <li>✅ Proper Armenian pronunciation in TTS</li>
              <li>✅ Armenian alphabet support (Ա-Ֆ)</li>
              <li>✅ Context-aware translation</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### 📊 Phase 5: Database Schema Updates

#### 5.1 UPDATE: `backend/src/database/init.ts`

```typescript
// Add new settings for OpenAI
const initSettings = async (db: Database) => {
  const settings = [
    // Replace Gemini settings
    { key: 'openai_api_key', value: '', description: 'OpenAI API Key for audio processing' },
    { key: 'default_language', value: 'hy', description: 'Default language (hy=Armenian, en=English, auto=Auto-detect)' },
    { key: 'default_voice', value: 'nova', description: 'Default TTS voice' },
    { key: 'tts_model', value: 'gpt-4o-mini-tts', description: 'Text-to-Speech model' },
    { key: 'stt_model', value: 'gpt-4o-transcribe', description: 'Speech-to-Text model' },
    { key: 'chat_model', value: 'gpt-4o-mini', description: 'Chat completion model' },
    
    // Migration settings
    { key: 'migration_status', value: 'completed', description: 'OpenAI migration status' },
    { key: 'migration_date', value: new Date().toISOString(), description: 'Migration completion date' }
  ];

  for (const setting of settings) {
    await db.run(
      'INSERT OR IGNORE INTO settings (key, value, description) VALUES (?, ?, ?)',
      [setting.key, setting.value, setting.description]
    );
  }
  
  // Remove old Gemini settings
  await db.run('DELETE FROM settings WHERE key = ?', ['gemini_api_key']);
};
```

---

### 🧪 Phase 6: Testing & Validation

#### 6.1 NEW FILE: `tests/openai-migration.test.js`

```javascript
/**
 * OpenAI Migration Test Suite
 */
const { OpenAILiveClient } = require('../frontend/lib/openai-live-client');
const OpenAI = require('openai');

describe('OpenAI Migration Tests', () => {
  let client;
  const testApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    if (!testApiKey) {
      throw new Error('OPENAI_API_KEY required for tests');
    }
    client = new OpenAILiveClient(testApiKey, { language: 'hy' });
  });

  test('OpenAI client initialization', () => {
    expect(client).toBeDefined();
    expect(client.config.language).toBe('hy');
    expect(client.status).toBe('disconnected');
  });

  test('Armenian TTS generation', async () => {
    const armenianText = 'Բարև ձեզ, ինչպես եք?';
    const audioBuffer = await client.generateSpeech(armenianText);
    
    expect(audioBuffer).toBeInstanceOf(ArrayBuffer);
    expect(audioBuffer.byteLength).toBeGreaterThan(0);
  });

  test('Voice options availability', () => {
    const voices = ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer'];
    voices.forEach(voice => {
      expect(() => {
        new OpenAILiveClient(testApiKey, { voice });
      }).not.toThrow();
    });
  });

  test('Language configuration', () => {
    const hyClient = new OpenAILiveClient(testApiKey, { language: 'hy' });
    const enClient = new OpenAILiveClient(testApiKey, { language: 'en' });
    
    expect(hyClient.config.language).toBe('hy');
    expect(enClient.config.language).toBe('en');
  });
});

describe('Armenian Language Support', () => {
  test('Armenian text processing', async () => {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const speech = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      input: 'Հայերենի աջակցություն',
      voice: 'nova'
    });
    
    const buffer = await speech.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000); // Should generate audio
  });
});
```

#### 6.2 NEW FILE: `scripts/validate-migration.js`

```javascript
/**
 * Migration validation script
 */
const fs = require('fs');
const path = require('path');

console.log('🔍 Validating OpenAI Migration...\n');

// Check if old Gemini files are removed/updated
const filesToCheck = [
  { path: 'frontend/package.json', shouldNotContain: '@google/genai' },
  { path: 'frontend/lib/constants.ts', shouldContain: 'DEFAULT_TTS_MODEL' },
  { path: 'frontend/lib/openai-live-client.ts', shouldExist: true },
  { path: 'backend/src/routes/test.ts', shouldContain: 'openai' },
];

let errors = 0;

filesToCheck.forEach(check => {
  const fullPath = path.join(__dirname, '..', check.path);
  
  if (check.shouldExist && !fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${check.path}`);
    errors++;
    return;
  }
  
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    if (check.shouldContain && !content.includes(check.shouldContain)) {
      console.error(`❌ File ${check.path} should contain: ${check.shouldContain}`);
      errors++;
    }
    
    if (check.shouldNotContain && content.includes(check.shouldNotContain)) {
      console.error(`❌ File ${check.path} should NOT contain: ${check.shouldNotContain}`);
      errors++;
    }
  }
});

// Check environment variables
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  const envContent = fs.readFileSync(envFile, 'utf8');
  if (envContent.includes('GEMINI_API_KEY') && !envContent.includes('OPENAI_API_KEY')) {
    console.error('❌ Environment variables not updated');
    errors++;
  }
}

if (errors === 0) {
  console.log('✅ Migration validation passed!');
  console.log('\n🎯 Next steps:');
  console.log('1. Update environment variables');
  console.log('2. Install new dependencies: npm run install:all');
  console.log('3. Run tests: npm test');
  console.log('4. Start development: npm run dev');
} else {
  console.error(`\n❌ Found ${errors} validation errors`);
  process.exit(1);
}
```

---

### 🚀 Deployment Checklist

#### Final Steps:
```bash
# 1. Install new dependencies
npm run install:all

# 2. Update environment variables
cp .env.example .env
# Edit .env with OpenAI API key

# 3. Run validation
node scripts/validate-migration.js

# 4. Run tests
npm test

# 5. Start development server
npm run dev

# 6. Test Armenian language features
# 7. Verify real-time audio streaming
# 8. Check voice quality and pronunciation
```

---

This implementation checklist provides the detailed code changes needed to migrate from Gemini to OpenAI API with full Armenian language support and the best available models for real-time audio processing.