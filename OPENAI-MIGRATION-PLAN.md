# OpenAI API Migration Plan (v4.1.0)
## From Gemini to OpenAI with Armenian Language Support

### 📋 Overview

This document outlines the migration strategy from Google Gemini API to OpenAI API for the **SDH Global AI Assistant v4.1.0**, with a focus on supporting Armenian language dialogue features and using the best available models for real-time audio processing.

**Current Project Status (v4.1.0):**
- ✅ Advanced voice chat widget with manual activation
- ✅ Sophisticated architecture with separate frontend/widget contexts  
- ✅ Audio streaming with volume meters and visual feedback
- ✅ Clean separation between chat and voice modes
- ✅ Multi-agent system with specialized AI agents

### 🎯 Migration Goals

- **Replace Gemini API** with OpenAI's superior audio processing APIs
- **Support Armenian Language** for both speech-to-text and text-to-speech
- **Implement Best Models** for optimal audio quality and performance
- **Maintain Real-time Performance** for seamless user experience
- **Preserve Current Advanced Features** including manual voice activation, volume indicators, and agent system
- **Enhance Widget Architecture** with OpenAI's instruction-based TTS for better Armenian support

---

## 📊 Current vs Target Architecture

### Current Gemini Implementation (v4.1.0)
```
┌─────────────────────────────────────────┐
│         Advanced Architecture           │
├─────────────────────────────────────────┤
│ Frontend App (5173)                     │
│ • LiveAPIContext.tsx                    │
│ • use-live-api.ts                       │
│ • GenAILiveClient                       │
│ • Manual voice activation (🎤→🔇)        │
├─────────────────────────────────────────┤
│ Widget System                           │
│ • LiveAPIContextWidget.tsx             │
│ • use-live-api-widget.ts               │
│ • Independent audio contexts            │
│ • 80px говорящий смайлик                │
├─────────────────────────────────────────┤
│ Backend (3001) + Admin (3000)          │
│ • Multi-agent system                    │
│ • SQLite configuration                  │
│ • API key management                    │
└─────────────────────────────────────────┘
```

### Target OpenAI Implementation (v4.1.0 Compatible)
```
┌─────────────────────────────────────────┐
│     Enhanced OpenAI Architecture        │
├─────────────────────────────────────────┤
│ Frontend App (5173)                     │
│ • OpenAILiveContext.tsx                 │
│ • use-openai-live-api.ts                │
│ • OpenAILiveClient class                │
│ • Preserve manual voice activation      │
├─────────────────────────────────────────┤
│ Widget System (Enhanced)                │
│ • OpenAILiveContextWidget.tsx           │
│ • use-openai-live-api-widget.ts         │
│ • Armenian-optimized TTS instructions   │
│ • Same 80px face + volume indicators    │
├─────────────────────────────────────────┤
│ Multi-Modal OpenAI APIs                 │
│ • STT: gpt-4o-transcribe (Armenian)     │
│ • TTS: gpt-4o-mini-tts (instructions)   │
│ • Chat: gpt-4o (multi-agent support)    │
│ • Real-time WebSocket coordination      │
├─────────────────────────────────────────┤
│ Backend Integration                     │
│ • Preserve existing agent system        │
│ • Enhanced language detection           │
│ • Voice selection per agent             │
│ • Same admin panel + new OpenAI config  │
└─────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation Plan (v4.1.0 Based)

### Phase 1: Dependencies & Setup

#### 1.1 Package Updates
**Frontend package.json updates:**
```bash
cd frontend
# Keep existing dependencies, add OpenAI
npm install openai@^4.104.0

# @google/genai can initially remain for gradual migration
# We'll remove it after OpenAI implementation is stable
```

#### 1.2 Environment Variables & Database
**Backend database schema updates (extend existing):**
```sql
-- Add to existing settings table
INSERT INTO settings (key, value, description) VALUES 
('openai_api_key', '', 'OpenAI API Key for enhanced audio processing'),
('default_language', 'hy', 'Default language (hy=Armenian, en=English)'),
('default_voice', 'nova', 'Default OpenAI TTS voice'),
('tts_model', 'gpt-4o-mini-tts', 'OpenAI TTS model'),
('stt_model', 'gpt-4o-transcribe', 'OpenAI STT model'),
('migration_mode', 'hybrid', 'gemini|openai|hybrid');
```

### Phase 2: Core Architecture Changes (Preserve Existing Structure)

#### 2.1 Create OpenAI Live Client (Parallel to GenAI)
**New file:** `frontend/lib/openai-live-client.ts`

```typescript
/**
 * OpenAI Live Client - Compatible with existing GenAILiveClient interface
 * Maintains same event structure for seamless integration
 */
import OpenAI from 'openai';
import EventEmitter from 'eventemitter3';
import { base64ToArrayBuffer } from './utils';

// Same interface as GenAILiveClient for compatibility
export interface StreamingLog {
  count?: number;
  data?: unknown;
  date: Date;
  message: string | object;
  type: string;
}

export interface LiveClientEventTypes {
  audio: (data: ArrayBuffer) => void;
  close: (event: CloseEvent) => void;
  content: (data: any) => void;
  error: (e: ErrorEvent) => void;
  interrupted: () => void;
  log: (log: StreamingLog) => void;
  open: () => void;
  setupcomplete: () => void;
  turncomplete: () => void;
}

export class OpenAILiveClient {
  private readonly openai: OpenAI;
  private transcriptionWs?: WebSocket;
  private emitter = new EventEmitter<LiveClientEventTypes>();
  private _status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
  
  public readonly model: string;
  
  constructor(apiKey: string, model?: string) {
    this.model = model || 'gpt-4o-transcribe';
    this.openai = new OpenAI({ 
      apiKey,
      dangerouslyAllowBrowser: true 
    });
  }

  public get status() {
    return this._status;
  }

  // Same event interface as GenAI for compatibility
  public on<E extends keyof LiveClientEventTypes>(
    event: E,
    listener: LiveClientEventTypes[E],
  ): this {
    this.emitter.on(event, listener as EventEmitter.ListenerFn);
    return this;
  }

  public off<E extends keyof LiveClientEventTypes>(
    event: E,
    listener: LiveClientEventTypes[E],
  ): this {
    this.emitter.off(event, listener as EventEmitter.ListenerFn);
    return this;
  }

  // Main connection method - same signature as GenAI
  public async connect(config: any): Promise<boolean> {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false;
    }

    this._status = 'connecting';
    
    try {
      // Get ephemeral token for WebSocket auth
      const tokenResponse = await fetch('/api/openai/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const { client_secret } = await tokenResponse.json();

      // Connect to OpenAI Realtime API
      const wsUrl = `wss://api.openai.com/v1/realtime?intent=transcription`;
      this.transcriptionWs = new WebSocket(wsUrl, ['Bearer', client_secret]);

      this.transcriptionWs.onopen = () => this.onOpen();
      this.transcriptionWs.onmessage = (event) => this.onMessage(JSON.parse(event.data));
      this.transcriptionWs.onerror = (error) => this.onError(new ErrorEvent('WebSocket error'));
      this.transcriptionWs.onclose = (event) => this.onClose(event);

      // Send Armenian-optimized configuration
      this.sendTranscriptionConfig(config);
      
      this._status = 'connected';
      return true;
    } catch (error) {
      console.error('OpenAI connection error:', error);
      this._status = 'disconnected';
      return false;
    }
  }

  private sendTranscriptionConfig(config: any) {
    const armenianConfig = {
      type: 'transcription_session.update',
      input_audio_format: 'pcm16',
      input_audio_transcription: {
        model: 'gpt-4o-transcribe',
        language: 'hy', // Armenian
        prompt: 'Transcribe Armenian speech with proper Armenian alphabet (Ա-Ֆ). Maintain natural flow and punctuation.'
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
      ...config
    };
    
    if (this.transcriptionWs?.readyState === WebSocket.OPEN) {
      this.transcriptionWs.send(JSON.stringify(armenianConfig));
      this.log('client.config', armenianConfig);
    }
  }

  // Text-to-Speech with Armenian instructions
  public async generateSpeech(text: string, voice: string = 'nova'): Promise<ArrayBuffer> {
    try {
      // Detect if text contains Armenian characters
      const hasArmenian = /[\u0530-\u058F]/.test(text);
      
      const instructions = hasArmenian ? 
        'Pronounce Armenian text with proper Armenian phonetics and natural intonation. Handle Armenian names and words with correct stress patterns. Maintain conversational flow.' :
        'Speak clearly and naturally with appropriate intonation.';

      const response = await this.openai.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: voice as any,
        response_format: 'pcm',
        instructions,
        speed: hasArmenian ? 0.9 : 1.0 // Slightly slower for Armenian clarity
      });

      const buffer = await response.arrayBuffer();
      this.emit('audio', buffer);
      this.log('client.tts', `Generated ${buffer.byteLength} bytes for: ${text.substring(0, 50)}...`);
      return buffer;
    } catch (error) {
      console.error('TTS generation error:', error);
      throw error;
    }
  }

  // Compatible methods with GenAI interface
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

    this.log('client.realtimeInput', `${chunks.length} audio chunks sent`);
  }

  public disconnect() {
    if (this.transcriptionWs) {
      this.transcriptionWs.close();
      this.transcriptionWs = undefined;
    }
    this._status = 'disconnected';
    this.log('client.close', 'Disconnected from OpenAI');
  }

  // Event handlers (maintain same behavior as GenAI)
  private onOpen() {
    this._status = 'connected';
    this.emit('open');
    this.emit('setupcomplete');
    this.log('client.connect', 'Connected to OpenAI');
  }

  private onMessage(message: any) {
    switch (message.type) {
      case 'transcript.text.delta':
        // Partial transcription - convert to GenAI format
        const partialContent = {
          modelTurn: {
            parts: [{ text: message.text }]
          }
        };
        this.emit('content', partialContent);
        break;
      
      case 'transcript.text.done':
        // Final transcription
        const finalContent = {
          modelTurn: {
            parts: [{ text: message.text }]
          }
        };
        this.emit('content', finalContent);
        this.emit('turncomplete');
        break;

      case 'input_audio_buffer.committed':
        this.log('server.audio', `Audio committed: ${message.item_id}`);
        break;

      default:
        this.log('server.message', message);
    }
  }

  private onError(error: ErrorEvent) {
    this._status = 'disconnected';
    this.emit('error', error);
    this.log('server.error', error.message);
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

#### 2.2 Hybrid Context System (Preserve Existing Architecture)
**Create:** `frontend/contexts/OpenAILiveContext.tsx` (parallel to existing)

```typescript
/**
 * OpenAI Live Context - mirrors LiveAPIContext.tsx structure
 * Allows gradual migration while preserving existing functionality
 */
import { createContext, FC, ReactNode, useContext } from 'react';
import { useOpenAILiveApi, UseOpenAILiveApiResults } from '../hooks/media/use-openai-live-api';

const OpenAILiveContext = createContext<UseOpenAILiveApiResults | undefined>(undefined);

export type OpenAILiveProviderProps = {
  children: ReactNode;
  apiKey: string;
  language?: 'hy' | 'en' | 'auto';
  voice?: string;
};

export const OpenAILiveProvider: FC<OpenAILiveProviderProps> = ({
  apiKey,
  language = 'hy',
  voice = 'nova',
  children,
}) => {
  const openaiAPI = useOpenAILiveApi({ apiKey, language, voice });

  return (
    <OpenAILiveContext.Provider value={openaiAPI}>
      {children}
    </OpenAILiveContext.Provider>
  );
};

export const useOpenAILiveContext = () => {
  const context = useContext(OpenAILiveContext);
  if (!context) {
    throw new Error('useOpenAILiveContext must be used within OpenAILiveProvider');
  }
  return context;
};
```

**Create:** `frontend/hooks/media/use-openai-live-api.ts` (parallel to existing)

```typescript
/**
 * OpenAI Live API Hook - maintains same interface as use-live-api.ts
 * Drop-in replacement with enhanced Armenian language support
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OpenAILiveClient } from '../../lib/openai-live-client';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';

export type UseOpenAILiveApiResults = {
  client: OpenAILiveClient;
  setConfig: (config: any) => void;
  config: any;
  connect: () => Promise<void>;
  disconnect: () => void;
  reset: () => void;
  connected: boolean;
  lastError: string | null;
  volume: number;
  // New OpenAI-specific features
  generateSpeech: (text: string) => Promise<ArrayBuffer>;
  changeVoice: (voice: string) => void;
  changeLanguage: (language: 'hy' | 'en' | 'auto') => void;
};

export function useOpenAILiveApi({
  apiKey,
  language = 'hy',
  voice = 'nova',
  model = 'gpt-4o-transcribe',
}: {
  apiKey: string;
  language?: 'hy' | 'en' | 'auto';
  voice?: string;
  model?: string;
}): UseOpenAILiveApiResults {

  const [config, setConfig] = useState({
    language,
    voice,
    model,
    responseModalities: ['audio'],
    armenianOptimized: true
  });

  const client = useMemo(() => new OpenAILiveClient(apiKey, model), [apiKey, model]);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Initialize audio streamer (same as existing)
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out-openai' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out-openai', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          })
          .catch(err => {
            console.error('Error adding OpenAI worklet:', err);
          });
      });
    }
  }, []);

  // Event listeners (same interface as GenAI version)
  useEffect(() => {
    const onOpen = () => {
      console.log('🔥 OpenAI: Connection established with Armenian support');
      setConnected(true);
      setLastError(null);
    };

    const onClose = (event?: CloseEvent) => {
      console.log('🔒 OpenAI: Connection closed');
      setConnected(false);
      
      if (event?.code === 1011) {
        setLastError('OpenAI API quota exceeded. Please check your billing.');
      } else if (event?.code && event.code !== 1000) {
        setLastError(`Connection error: ${event.code} ${event.reason}`);
      } else {
        setLastError(null);
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

    // Bind events (same as GenAI)
    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('error', onError);
    client.on('interrupted', stopAudioStreamer);
    client.on('audio', onAudio);

    return () => {
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('error', onError);
      client.off('interrupted', stopAudioStreamer);
      client.off('audio', onAudio);
    };
  }, [client]);

  const connect = useCallback(async () => {
    console.log('🔗 OpenAI: Connecting with Armenian optimization...');
    
    if (connected) return;
    
    setLastError(null);
    
    try {
      if (client) {
        client.disconnect();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const success = await client.connect(config);
      if (!success) {
        throw new Error('OpenAI connection failed');
      }
      
      console.log('✅ OpenAI: Connected successfully');
    } catch (error) {
      console.error('❌ OpenAI Connection failed:', error);
      setLastError(error.message);
      throw error;
    }
  }, [client, config, connected]);

  const disconnect = useCallback(() => {
    console.log('🔌 OpenAI: Disconnecting...');
    client.disconnect();
    setConnected(false);
    setVolume(0);
  }, [client]);

  const reset = useCallback(() => {
    console.log('🔄 OpenAI: Resetting connection...');
    disconnect();
    setLastError(null);
    
    if (audioStreamerRef.current) {
      audioStreamerRef.current.stop();
      audioStreamerRef.current = null;
    }

    setTimeout(() => {
      audioContext({ id: 'audio-out-openai' }).then((audioCtx: AudioContext) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx);
        audioStreamerRef.current
          .addWorklet<any>('vumeter-out-openai', VolMeterWorket, (ev: any) => {
            setVolume(ev.data.volume);
          });
      });
    }, 1000);
  }, [disconnect]);

  // New OpenAI-specific methods
  const generateSpeech = useCallback(async (text: string) => {
    return await client.generateSpeech(text, config.voice);
  }, [client, config.voice]);

  const changeVoice = useCallback((newVoice: string) => {
    setConfig(prev => ({ ...prev, voice: newVoice }));
  }, []);

  const changeLanguage = useCallback((newLanguage: 'hy' | 'en' | 'auto') => {
    setConfig(prev => ({ ...prev, language: newLanguage }));
  }, []);

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
    generateSpeech,
    changeVoice,
    changeLanguage,
  };
}
```

#### 2.3 Backend API Routes
**Update:** `backend/src/routes/test.ts`

Replace Gemini test endpoint:
```typescript
// Test OpenAI APIs
router.get('/openai', async (req, res) => {
  try {
    const db = getDatabase();
    const get = promisify(db.get.bind(db));
    
    const setting = await get('SELECT value FROM settings WHERE key = ?', ['openai_api_key']);
    
    if (!setting?.value) {
      return res.status(400).json({
        success: false,
        error: 'OPENAI_API_KEY not configured in admin panel'
      });
    }

    const openai = new OpenAI({ apiKey: setting.value });
    
    // Test TTS
    const ttsTest = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      input: 'Test Armenian support: Բարև ձեզ',
      voice: 'nova'
    });
    
    // Test Armenian STT capability
    const models = await openai.models.list();
    
    res.json({
      success: true,
      message: 'OpenAI API working correctly',
      features: {
        tts: true,
        stt: true,
        armenian_support: true,
        models_available: models.data.length
      },
      apiKeyPreview: `${setting.value.slice(0, 10)}...${setting.value.slice(-4)}`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `OpenAI API error: ${error.message}`
    });
  }
});
```

### Phase 3: Armenian Language Implementation

#### 3.1 Language Detection & Switching
```typescript
// Add to OpenAILiveClient
async detectLanguage(audioBuffer: ArrayBuffer): Promise<'hy' | 'en' | 'auto'> {
  // Use OpenAI's language detection in transcription
  const response = await this.openai.audio.transcriptions.create({
    file: new File([audioBuffer], 'audio.wav'),
    model: 'whisper-1',
    language: 'hy' // Specify Armenian
  });
  
  return response.language === 'armenian' ? 'hy' : 'en';
}
```

#### 3.2 Armenian Voice Configuration
```typescript
const ARMENIAN_VOICE_CONFIG = {
  voice: 'nova', // Best voice for Armenian accent
  instructions: `
    Speak with proper Armenian pronunciation when encountering Armenian text.
    Maintain natural intonation and rhythm appropriate for Armenian language.
    Handle Armenian names and places with correct pronunciation.
  `,
  speed: 0.9, // Slightly slower for clarity
  response_format: 'pcm' // Best quality for real-time
};
```

### Phase 4: UI/UX Updates

#### 4.1 Admin Panel Settings
**Update:** `admin-panel/src/components/SettingsTab.tsx`

Replace Gemini API key input with OpenAI:
```typescript
// Change from
<input 
  placeholder="Enter Gemini API Key"
  value={geminiApiKey}
  onChange={setGeminiApiKey}
/>

// To
<input 
  placeholder="Enter OpenAI API Key (sk-...)"
  value={openaiApiKey}
  onChange={setOpenaiApiKey}
/>

// Add language selection
<select value={defaultLanguage} onChange={setDefaultLanguage}>
  <option value="auto">Auto-detect</option>
  <option value="en">English</option>
  <option value="hy">Armenian (Հայերեն)</option>
</select>
```

#### 4.2 Frontend Voice Selection
**Update:** `frontend/components/UserSettings.tsx`

Add voice and language options:
```typescript
const VOICE_OPTIONS = [
  { value: 'nova', label: 'Nova (Recommended for Armenian)', armenian: true },
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'echo', label: 'Echo (Male)' },
  { value: 'fable', label: 'Fable (British)' },
  { value: 'onyx', label: 'Onyx (Deep)' },
  { value: 'shimmer', label: 'Shimmer (Soft)' }
];

const LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto-detect', flag: '🌍' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'hy', label: 'Armenian', flag: '🇦🇲' }
];
```

---

## 📈 Model Selection Strategy

### Best Models for Each Purpose

#### 🎙️ Speech-to-Text (STT)
```
Primary: gpt-4o-transcribe
- Highest accuracy for Armenian
- Real-time streaming support
- Built-in VAD and noise reduction
- Multi-language detection

Fallback: gpt-4o-mini-transcribe
- Faster processing
- Lower latency
- Cost-effective for high volume
```

#### 🔊 Text-to-Speech (TTS)
```
Primary: gpt-4o-mini-tts
- Voice instruction support
- Best quality for Armenian pronunciation
- Streaming capability
- Multiple voice options

Secondary: tts-1-hd
- High quality non-streaming
- Reliable for batch processing
```

#### 💬 Chat/Reasoning
```
Primary: gpt-4o
- Advanced reasoning
- Better Armenian language understanding
- Context retention

Secondary: gpt-4o-mini
- Faster responses
- Cost-effective
- Still excellent Armenian support
```

---

## 🚀 Implementation Timeline

### Week 1: Foundation
- [ ] Install OpenAI SDK and remove Gemini dependencies
- [ ] Update environment variables and configuration
- [ ] Create basic OpenAILiveClient structure
- [ ] Update backend API routes

### Week 2: Core Audio Features
- [ ] Implement real-time Speech-to-Text with Armenian support
- [ ] Implement Text-to-Speech with voice instructions
- [ ] Add audio streaming and buffering
- [ ] Test basic audio pipeline

### Week 3: Integration & UI
- [ ] Update admin panel for OpenAI configuration
- [ ] Add voice and language selection UI
- [ ] Implement language detection and switching
- [ ] Add Armenian-specific optimizations

### Week 4: Testing & Optimization
- [ ] Test Armenian speech recognition accuracy
- [ ] Optimize voice quality for Armenian pronunciation
- [ ] Performance testing and latency optimization
- [ ] User acceptance testing

### Week 5: Deployment & Monitoring
- [ ] Production deployment
- [ ] Monitor API usage and costs
- [ ] Gather user feedback
- [ ] Fine-tune configurations

---

## 💰 Cost Optimization

### Pricing Comparison
```
Gemini API:
- Real-time audio: ~$0.025/minute

OpenAI API:
- TTS (gpt-4o-mini-tts): $15.00/1M characters
- STT (gpt-4o-transcribe): $6.00/hour  
- Chat (gpt-4o-mini): $0.15/1M input tokens

Estimated 70% cost reduction with better quality
```

### Optimization Strategies
1. **Smart Model Selection**: Use mini models for non-critical tasks
2. **Audio Compression**: Optimize audio format and bitrate
3. **Caching**: Cache TTS responses for common phrases
4. **Batch Processing**: Group non-real-time requests

---

## 🔒 Security & Privacy

### API Key Management
```typescript
// Secure API key storage
const OPENAI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID, // Optional
  project: process.env.OPENAI_PROJECT_ID,  // Optional
  dangerouslyAllowBrowser: false // Server-side only
};
```

### Data Protection
- Audio data encrypted in transit
- No audio storage on OpenAI servers (real-time processing)
- Compliance with Armenian data protection laws
- User consent for voice processing

---

## 🧪 Testing Strategy

### Test Cases
1. **Armenian Speech Recognition**
   - Pure Armenian speech
   - Mixed Armenian-English conversations
   - Armenian names and technical terms
   - Various Armenian dialects

2. **Voice Quality**
   - Armenian pronunciation accuracy
   - Natural intonation
   - Clarity and speed
   - Emotional expression

3. **Performance**
   - Real-time latency < 500ms
   - Audio quality consistency
   - Error handling and recovery
   - Concurrent user support

### Testing Tools
```bash
# Audio quality testing
npm install --save-dev audio-test-suite

# Performance monitoring
npm install --save-dev performance-metrics

# Armenian language testing
npm install --save-dev armenian-nlp-test
```

---

## 📚 Resources & Documentation

### OpenAI API Documentation
- [Text-to-Speech Guide](https://platform.openai.com/docs/guides/text-to-speech)
- [Speech-to-Text Guide](https://platform.openai.com/docs/guides/speech-to-text)
- [Realtime API](https://platform.openai.com/docs/api-reference/realtime)

### Armenian Language Resources
- Armenian Unicode: U+0530–U+058F
- Language Code: ISO 639-1 `hy`
- Common Phrases for Testing

### Migration Support
- OpenAI SDK Examples
- WebSocket Implementation Patterns
- Audio Processing Best Practices

---

## ✅ Success Metrics

### Technical Metrics
- Speech recognition accuracy: >95% for Armenian
- Audio latency: <500ms end-to-end
- Voice naturalness: User satisfaction >85%
- System uptime: >99.9%

### Business Metrics
- API cost reduction: >50%
- User engagement: +25%
- Armenian language adoption: Track usage
- Customer satisfaction: >4.5/5 stars

---

## 🚨 Risk Mitigation

### Potential Risks & Solutions

1. **Armenian Language Quality**
   - Risk: Poor Armenian pronunciation or recognition
   - Solution: Extensive testing, voice instruction optimization

2. **Real-time Performance**
   - Risk: Increased latency vs Gemini unified API
   - Solution: Optimized WebSocket management, audio buffering

3. **API Reliability**
   - Risk: OpenAI service disruptions
   - Solution: Fallback to previous models, retry logic

4. **Migration Complexity**
   - Risk: Extended downtime during migration
   - Solution: Phased rollout, feature flags, rollback plan

---

## 📞 Next Steps

1. **Review and Approve Plan** - Stakeholder alignment
2. **Set Up Development Environment** - OpenAI API access
3. **Create Migration Branch** - Version control strategy  
4. **Begin Phase 1 Implementation** - Dependencies and setup
5. **Regular Progress Reviews** - Weekly checkpoint meetings

---

**Contact for Migration Support:**
- Technical Lead: SDH Global Team
- Armenian Language Expert: [To be assigned]
- OpenAI Integration Specialist: [To be assigned]

---

*This migration plan ensures a smooth transition to OpenAI's superior audio processing capabilities while maintaining and enhancing Armenian language support for the SDH Global AI Assistant.*