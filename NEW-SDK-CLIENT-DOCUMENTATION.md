# New SDK Client Documentation (MediaRecorder → Google GenAI SDK)

## Overview

This document covers the **New SDK Client** implementation for Gemini Live API using the official Google GenAI SDK (`@google/genai`) with the migration from legacy MediaRecorder approach to the modern client architecture.

## Migration Background

Based on the [Google GenAI SDK Migration Guide](https://ai.google.dev/gemini-api/docs/migrate), we are transitioning from:

- **Before**: Direct API calls with MediaRecorder audio handling
- **After**: Centralized Client object with proper Live API integration

## Key Architecture Changes

### 1. Client Initialization

**Before (Legacy Approach)**:
```typescript
// Direct model instantiation
import { GoogleGenerativeAI } from '@google/generative-ai';
const ai = new GoogleGenerativeAI({ apiKey });
const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
```

**After (New SDK Client)**:
```typescript
// Centralized client with live.connect() method
import { GoogleGenAI, Modality } from '@google/genai';
const client = new GoogleGenAI({ apiKey });
const session = await client.live.connect({ model, config, callbacks });
```

### 2. Live API Connection Pattern

The new SDK uses a centralized `live.connect()` method with proper configuration structure:

```typescript
const session = await this.ai.live.connect({
  model: 'gemini-2.5-flash-native-audio-preview-09-2025',
  config: {
    responseModalities: [Modality.AUDIO, Modality.TEXT],
    speechConfig: { 
      voiceConfig: { 
        prebuiltVoiceConfig: { voiceName: 'Orus' } 
      } 
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    systemInstruction: systemInstruction,
  },
  callbacks: {
    onopen: () => { /* connection established */ },
    onmessage: (message) => { /* handle responses */ },
    onerror: (error) => { /* handle errors */ },
    onclose: (event) => { /* cleanup */ }
  }
});
```

### 3. Audio Processing Evolution

#### MediaRecorder Issues (Original Approach)
```typescript
// ❌ PROBLEMATIC: MediaRecorder produces incompatible audio format
this.mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus'  // Wrong format for Gemini Live
});

this.mediaRecorder.ondataavailable = (event) => {
  // WebM/Opus format - not compatible with Gemini Live API
  const audioBlob = event.data;
};
```

#### ScriptProcessorNode Solution (Fixed)
```typescript
// ✅ CORRECT: ScriptProcessorNode with PCM format
this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

this.scriptProcessor.onaudioprocess = (event) => {
  const inputBuffer = event.inputBuffer;
  const inputData = inputBuffer.getChannelData(0);
  
  // Convert Float32Array to Int16Array (PCM)
  const pcmData = new Int16Array(inputData.length);
  for (let i = 0; i < inputData.length; i++) {
    pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
  }
  
  // Send PCM data to Gemini Live API
  if (this.session) {
    this.session.send(pcmData);
  }
};
```

## Current Implementation Status

### File: `gemini-live-client-sdk.ts`

Our current implementation successfully uses:

1. **Proper SDK Import**: `import { GoogleGenAI, Modality } from '@google/genai';`
2. **Centralized Client**: `new GoogleGenAI({ apiKey })`
3. **Live API Connection**: `this.ai.live.connect()`
4. **Fixed Audio Processing**: ScriptProcessorNode with PCM format
5. **Proper Configuration**: Official LiveConnectConfig structure

### Key Features

#### Voice Configuration
```typescript
speechConfig: { 
  voiceConfig: { 
    prebuiltVoiceConfig: { voiceName: voiceName || 'Orus' } 
  } 
}
```

**Available Voices**: Orus, Aoede, Kore, Charon, Fenrir, Zephyr, Zeus, Helios, etc. (30 total voices)

#### Multilingual Support
```typescript
systemInstruction: `You are a helpful AI assistant. 
${agent?.agent_language === 'hy-AM' ? 
  'CRITICAL: You MUST respond ONLY in Armenian (Հայերեն). Never use English, Russian, or any other language.' :
  'Respond in the user\'s language or the configured language.'
}`
```

#### Transcription Support
```typescript
inputAudioTranscription: {},   // Transcribe user speech
outputAudioTranscription: {},  // Transcribe AI responses
```

## Audio Format Requirements

### Input Audio (User → API)
- **Format**: PCM (Pulse Code Modulation)
- **Sample Rate**: 16kHz
- **Channels**: Mono (1 channel)
- **Bit Depth**: 16-bit signed integers
- **Encoding**: Base64 for WebSocket transmission

### Output Audio (API → User)
- **Format**: PCM 
- **Sample Rate**: 24kHz
- **Channels**: Mono (1 channel)
- **Bit Depth**: 16-bit signed integers

## Message Handling

The new SDK provides structured message objects:

```typescript
private handleMessage(message: any): void {
  // Text responses
  if (message.text) {
    this.onMessageCallback?.(message.text);
  }

  // Audio responses (PCM data)
  if (message.audio) {
    this.onAudioCallback?.(message.audio);
    this.playAudio(message.audio);
  }

  // Transcriptions
  if (message.inputTranscription) {
    console.log('User said:', message.inputTranscription);
  }

  if (message.outputTranscription) {
    console.log('AI said:', message.outputTranscription);
  }
}
```

## Error Handling & Diagnostics

### Connection Monitoring
```typescript
callbacks: {
  onopen: () => {
    console.log('✅ Gemini Live SDK: Session opened');
    this.isConnected = true;
  },
  onerror: (error) => {
    console.error('❌ Gemini Live SDK: Session error:', error);
    this.isConnected = false;
    this.onErrorCallback?.(`Session error: ${error}`);
  },
  onclose: (event) => {
    console.warn('❌ Gemini Live SDK: Session closed');
    this.isConnected = false;
    if (this.isRecording) {
      this.stopRecording();
    }
  }
}
```

### Audio Processing Validation
```typescript
// Validate audio context and processing chain
if (!this.audioContext || this.audioContext.state === 'closed') {
  throw new Error('Audio context not available or closed');
}

// Verify PCM data format before sending
if (pcmData instanceof Int16Array) {
  this.session.send(pcmData);
} else {
  console.error('Invalid audio data format:', typeof pcmData);
}
```

## Language-Specific Features

### Armenian Language Support
- **Voice Override**: Armenian agents automatically use "Orus" voice (firm, clear)
- **Language Enforcement**: Strong system instruction formatting to prevent language mixing
- **Auto-detection**: Automatic language detection with fallback to configured language

### Supported Languages
- **Armenian (hy-AM)**: Full support with dedicated voice
- **Russian (ru-RU)**: Native support
- **English (en-US)**: Default fallback
- **Auto**: Automatic language detection

## Performance Considerations

### Audio Latency Optimization
```typescript
// Use small buffer size for lower latency
this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);

// Immediate audio processing without buffering
this.scriptProcessor.onaudioprocess = (event) => {
  // Process and send immediately
  this.processAndSendAudio(event.inputBuffer);
};
```

### Memory Management
```typescript
// Cleanup resources properly
disconnect(): void {
  if (this.scriptProcessor) {
    this.scriptProcessor.disconnect();
    this.scriptProcessor = null;
  }
  
  if (this.audioContext && this.audioContext.state !== 'closed') {
    this.audioContext.close();
  }
  
  if (this.session) {
    this.session.close();
    this.session = null;
  }
}
```

## Testing & Validation

### Connection Test
```typescript
async testConnection(): Promise<boolean> {
  try {
    await this.connect(testAgent);
    return this.isConnected;
  } catch (error) {
    console.error('Connection test failed:', error);
    return false;
  }
}
```

### Audio Format Validation
```typescript
private validateAudioFormat(data: any): boolean {
  if (!(data instanceof Int16Array)) {
    console.error('Invalid audio format. Expected Int16Array, got:', typeof data);
    return false;
  }
  
  if (data.length === 0) {
    console.warn('Empty audio buffer detected');
    return false;
  }
  
  return true;
}
```

## Migration Checklist

- [x] **SDK Installation**: Migrated from `@google/generative-ai` to `@google/genai`
- [x] **Client Architecture**: Using centralized `GoogleGenAI` client object
- [x] **Live API Integration**: Implemented `live.connect()` method
- [x] **Audio Format Fix**: Replaced MediaRecorder with ScriptProcessorNode
- [x] **Configuration Structure**: Updated to official `LiveConnectConfig` format
- [x] **Voice System**: Integrated 30 prebuilt voices with proper naming
- [x] **Error Handling**: Comprehensive error handling and logging
- [x] **Transcription Support**: Both input and output transcriptions
- [x] **Language Support**: Armenian, Russian, English with auto-detection
- [ ] **Performance Optimization**: Buffer size tuning and latency reduction
- [ ] **UI Integration**: Debug panel for easier troubleshooting

## Known Issues & Solutions

### Issue 1: MediaRecorder Audio Format
**Problem**: MediaRecorder produces WebM/Opus audio incompatible with Gemini Live API
**Solution**: Use ScriptProcessorNode with PCM format conversion

### Issue 2: Voice Parameters Not Applied
**Problem**: Hardcoded voice values overriding dynamic configuration
**Solution**: Remove hardcoded fallbacks, use proper `prebuiltVoiceConfig` structure

### Issue 3: Session Connection Stability
**Problem**: Intermittent connection drops and errors
**Solution**: Implement proper error handling, reconnection logic, and resource cleanup

## Future Enhancements

1. **Advanced Voice Selection**: Dynamic voice selection based on content type
2. **Audio Effects**: Real-time audio processing and effects
3. **Batch Processing**: Multiple audio chunks optimization
4. **Quality Adaptation**: Automatic quality adjustment based on connection
5. **Custom Voice Training**: Integration with custom voice models

## References

- [Google GenAI SDK Migration Guide](https://ai.google.dev/gemini-api/docs/migrate)
- [Official Google GenAI Library](https://github.com/googleapis/js-genai)
- [Gemini Live API Documentation](https://ai.google.dev/gemini-api/docs/live)
- [Audio Format Specifications](https://ai.google.dev/gemini-api/docs/live-guide)

---

*Last Updated: November 7, 2025*
*Implementation Status: Active Development*
*Test Frontend: localhost:5175*