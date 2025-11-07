# 🎯 **Google GenAI Live API - Complete Implementation Guide**

## 📚 **Полный рабочий пример со всеми параметрами**

Этот документ содержит **официальный полный пример** использования Google GenAI Live API с **всеми необходимыми функциями** для работы с аудио в реальном времени.

---

## 🔧 **Полная реализация**

```typescript
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from '@google/genai';

// --- Audio Utility Functions ---
// These functions are necessary for handling the raw PCM audio data from the API.

/**
 * Encodes raw audio bytes into a Base64 string.
 */
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a Base64 string into raw audio bytes (Uint8Array).
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data into an AudioBuffer for playback.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Creates a Blob object for sending audio data to the Gemini API.
 */
function createPcmBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000', // Input audio must be 16kHz.
    };
}


// --- Main Application Logic ---

async function runLiveConversation() {
  // Ensure the API key is set in your environment variables
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set.");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // --- State and Reference Management ---
  // In a real app, you'd use a state management library (e.g., React state).
  let currentInputTranscription = '';
  let currentOutputTranscription = '';
  let transcriptLog: { role: 'user' | 'model', text: string }[] = [];

  // Audio context for microphone input (16kHz) and speaker output (24kHz).
  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  // --- Audio Playback Queue ---
  // This ensures smooth, gapless playback of audio chunks from the model.
  let nextStartTime = 0;
  const outputSources = new Set<AudioBufferSourceNode>();

  // Get microphone access
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const connectionConfig = {
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { 
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } 
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      systemInstruction: `You are a helpful and friendly assistant. Start the conversation with a short welcome message.`,
    },
  };

  // Start the connection. This returns a promise that resolves with the session object.
  const sessionPromise = ai.live.connect({
    ...connectionConfig,
    callbacks: {
      onopen: () => {
        console.log('Session opened. Start speaking.');

        // --- Start Streaming Microphone Audio ---
        const source = inputAudioContext.createMediaStreamSource(stream);
        // Using a ScriptProcessorNode is a reliable way to get raw audio data.
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
          const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData);
          
          // Send audio data only after the session promise has resolved.
          sessionPromise.then((session) => {
            session.sendRealtimeInput({ media: pcmBlob });
          });
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);
      },
      onmessage: async (message: LiveServerMessage) => {
        // --- Process Transcription ---
        if (message.serverContent?.inputTranscription) {
          currentInputTranscription += message.serverContent.inputTranscription.text;
        }
        if (message.serverContent?.outputTranscription) {
          currentOutputTranscription += message.serverContent.outputTranscription.text;
        }

        // When a full turn is complete, log the transcripts and reset.
        if (message.serverContent?.turnComplete) {
          const userInput = currentInputTranscription.trim();
          if (userInput) {
            transcriptLog.push({ role: 'user', text: userInput });
            console.log('User:', userInput);
          }
          const modelOutput = currentOutputTranscription.trim();
          if (modelOutput) {
            transcriptLog.push({ role: 'model', text: modelOutput });
            console.log('Model:', modelOutput);
          }
          currentInputTranscription = '';
          currentOutputTranscription = '';
        }

        // --- Process and Play Audio Output ---
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio) {
            // Ensure the next audio chunk starts right after the previous one finishes.
            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);

            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.addEventListener('ended', () => outputSources.delete(source));
            
            source.start(nextStartTime);
            nextStartTime += audioBuffer.duration; // Schedule the next chunk
            outputSources.add(source);
        }
      },
      onerror: (e: ErrorEvent) => {
        console.error('Session error:', e);
      },
      onclose: () => {
        console.log('Session closed.');
      },
    },
  });

  console.log('Live conversation session is connecting...');
}

runLiveConversation();
```

---

## 🔑 **Ключевые особенности этой реализации**

### ✅ **1. Правильная обработка аудио**
```typescript
// Input: 16kHz для микрофона
const inputAudioContext = new AudioContext({ sampleRate: 16000 });

// Output: 24kHz для воспроизведения ответов AI
const outputAudioContext = new AudioContext({ sampleRate: 24000 });
```

### ✅ **2. Гладкое воспроизведение без пауз**
```typescript
// Audio Playback Queue - обеспечивает плавное воспроизведение
let nextStartTime = 0;
const outputSources = new Set<AudioBufferSourceNode>();

// Каждый следующий аудио чанк начинается сразу после предыдущего
nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
source.start(nextStartTime);
nextStartTime += audioBuffer.duration;
```

### ✅ **3. Правильная конфигурация соединения**
```typescript
const connectionConfig = {
  model: 'gemini-2.5-flash-native-audio-preview-09-2025',
  config: {
    responseModalities: [Modality.AUDIO], // Только аудио ответы
    speechConfig: { 
      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } 
    },
    inputAudioTranscription: {},    // Включить транскрипцию входящего аудио
    outputAudioTranscription: {},   // Включить транскрипцию исходящего аудио
    systemInstruction: `Your system prompt here`,
  },
};
```

### ✅ **4. Обработка транскрипций**
```typescript
// Накапливаем транскрипцию по фрагментам
if (message.serverContent?.inputTranscription) {
  currentInputTranscription += message.serverContent.inputTranscription.text;
}
if (message.serverContent?.outputTranscription) {
  currentOutputTranscription += message.serverContent.outputTranscription.text;
}

// Когда turn завершен, сохраняем полную транскрипцию
if (message.serverContent?.turnComplete) {
  transcriptLog.push({ role: 'user', text: currentInputTranscription.trim() });
  transcriptLog.push({ role: 'model', text: currentOutputTranscription.trim() });
  // Сбрасываем для нового turn
  currentInputTranscription = '';
  currentOutputTranscription = '';
}
```

---

## 🎙️ **Доступные голоса (voiceName)**

```typescript
// Мужские голоса
'Kore'     // Основной мужской голос
'Charon'   // Глубокий мужской голос
'Atlas'    // Сильный мужской голос

// Женские голоса  
'Zephyr'   // Основной женский голос (рекомендуемый)
'Iona'     // Мягкий женский голос
'Luna'     // Молодой женский голос

// И многие другие...
```

---

## 🔧 **Модификации для разных случаев использования**

### **🎯 Добавить TEXT модальность для текстовых ответов**
```typescript
responseModalities: [Modality.AUDIO, Modality.TEXT],
```

### **🎯 Изменить язык системных инструкций**
```typescript
systemInstruction: `Ты полезный ИИ-ассистент. Отвечай на армянском языке. Начни разговор с короткого приветствия.`,
```

### **🎯 Настроить качество аудио**
```typescript
speechConfig: { 
  voiceConfig: { 
    prebuiltVoiceConfig: { 
      voiceName: 'Zephyr',
      languageCode: 'en-US',  // Опционально
      speakingRate: 1.0,      // Скорость речи (0.25 - 4.0)
      pitch: 0.0              // Высота тона (-20.0 - 20.0)
    } 
  } 
},
```

### **🎯 Добавить обработку ошибок**
```typescript
onerror: (e: ErrorEvent) => {
  console.error('Session error:', e);
  // Переподключиться автоматически
  setTimeout(() => runLiveConversation(), 3000);
},
```

---

## 📋 **Checklist для интеграции**

### ✅ **Обязательные шаги:**
1. **Установить зависимости:**
   ```bash
   npm install @google/genai
   ```

2. **Настроить API ключ:**
   ```bash
   export API_KEY="your-google-ai-api-key"
   ```

3. **Добавить утилиты для аудио:**
   - `encode()` - конвертация в base64
   - `decode()` - конвертация из base64  
   - `decodeAudioData()` - создание AudioBuffer
   - `createPcmBlob()` - создание PCM blob для отправки

4. **Настроить аудио контексты:**
   - Input: 16kHz для микрофона
   - Output: 24kHz для воспроизведения

5. **Реализовать gapless playback:**
   - Использовать `nextStartTime` для плавного воспроизведения
   - Управлять `outputSources` набором

---

## 🚀 **Преимущества этого подхода**

### ✅ **Надежность:**
- Официальный пример от Google
- Протестированные утилиты для аудио
- Правильная обработка PCM формата

### ✅ **Производительность:**
- Gapless audio playback (без пауз)
- Эффективная обработка аудио чанков
- Минимальная задержка

### ✅ **Функциональность:**
- Полная поддержка транскрипций
- Управление состоянием разговора
- Обработка ошибок и переподключений

---

## 🔄 **Интеграция с нашим SDK Client**

Для интеграции с нашим `GeminiLiveClientSDK`, мы можем:

1. **Заменить аудио утилиты** нашими на официальные
2. **Добавить gapless playback** вместо простого `playAudio()`
3. **Улучшить управление транскрипциями** с накоплением по turns
4. **Добавить правильные AudioContext** с разными sample rates

---

## 📚 **Источники**

- **Официальная документация:** [Google AI JavaScript SDK](https://github.com/googleapis/js-genai)
- **Live API Guide:** [Gemini Live API Documentation](https://ai.google.dev/api/live)
- **Примеры кода:** [SDK Samples](https://github.com/googleapis/js-genai/tree/main/sdk-samples)

---

*Этот пример представляет собой **золотой стандарт** для работы с Google GenAI Live API и должен использоваться как основа для всех реализаций реального времени аудио.*