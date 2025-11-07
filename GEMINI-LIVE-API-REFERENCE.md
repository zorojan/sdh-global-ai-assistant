# Gemini Live API Reference

## Client Implementation Variants

### 1. New SDK Client (Recommended)
- **File**: `gemini-live-client-sdk.ts`
- **Approach**: Official Google GenAI SDK (`@google/genai`) with `live.connect()`
- **Audio**: ScriptProcessorNode with PCM format (fixed MediaRecorder issues)
- **Status**: ✅ Fully functional with proper audio format and voice parameters
- **Documentation**: See `NEW-SDK-CLIENT-DOCUMENTATION.md`

### 2. Working Implementation 
- **File**: `gemini-live-client-working-fixed.ts`
- **Approach**: Direct WebSocket with proven ScriptProcessorNode
- **Audio**: PCM 16kHz input, 24kHz output
- **Status**: ✅ Reference implementation

### 3. Frontend Implementation
- **File**: `gemini-live-client-frontend.ts` 
- **Approach**: Dual modality (AUDIO + TEXT) with transcriptions
- **Audio**: ScriptProcessorNode with enhanced logging
- **Status**: ✅ Updated with proper voice parameters

## Available Voices (30 total)

According to official documentation at https://ai.google.dev/gemini-api/docs/speech-generation#voices

| Voice Name | Style | Voice Name | Style | Voice Name | Style |
|------------|-------|------------|-------|------------|-------|
| Zephyr | Bright | Puck | Upbeat | Charon | Informative |
| Kore | Firm | Fenrir | Excitable | Leda | Youthful |
| **Orus** | **Firm** | **Aoede** | **Breezy** | Callirrhoe | Easy-going |
| Autonoe | Bright | Enceladus | Breathy | Iapetus | Clear |
| Umbriel | Easy-going | Algieba | Smooth | Despina | Smooth |
| Erinome | Clear | Algenib | Gravelly | Rasalgethi | Informative |
| Laomedeia | Upbeat | Achernar | Soft | Alnilam | Firm |
| Schedar | Even | Gacrux | Mature | Pulcherrima | Forward |
| Achird | Friendly | Zubenelgenubi | Casual | Vindemiatrix | Gentle |
| Sadachbia | Lively | Sadaltager | Knowledgeable | Sulafat | Warm |

## Configuration Structure

### Full Live API Connection Config
```javascript
const connectConfig = {
    model: "gemini-2.5-flash-native-audio-preview-09-2025", // or "gemini-2.0-flash-live-001"
    callbacks: {
        onopen: () => console.log('Session opened'),
        onmessage: (message) => handleMessage(message),
        onerror: (error) => console.error('Error:', error),
        onclose: () => console.log('Session closed')
    },
    config: {
        responseModalities: ["AUDIO"], // or ["AUDIO", "TEXT"] for transcriptions
        speechConfig: {
            voiceConfig: {
                prebuiltVoiceConfig: {
                    voiceName: "Orus" // Any of the 30 available voices
                }
            }
        },
        inputAudioTranscription: {}, // Enable input transcription
        outputAudioTranscription: {}, // Enable output transcription
        systemInstruction: "Your system instruction here...",
        // Optional advanced features:
        realtimeInputConfig: {
            automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
                endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
                prefixPaddingMs: 20,
                silenceDurationMs: 100
            }
        },
        thinkingConfig: {
            thinkingBudget: 1024,
            includeThoughts: true
        }
    }
}
```

### Speech Config Options
```javascript
speechConfig: {
    voiceConfig: {
        prebuiltVoiceConfig: {
            voiceName: "Orus" // Required: one of 30 voices
        }
    }
}
```

## Supported Languages

**Live API automatically detects language** and supports:
- Armenian (hy-AM) ✅
- Russian (ru-RU) ✅  
- English (en-US) ✅
- German (de-DE), French (fr-FR), Spanish (es-ES), Italian (it-IT)
- Japanese (ja-JP), Korean (ko-KR), Chinese (cmn-CN)
- Hindi (hi-IN), Arabic (ar-XA), Portuguese (pt-BR)
- And 18+ more languages

## Audio Format Requirements

- **Input**: PCM 16-bit, 16kHz, mono
- **Output**: PCM 16-bit, 24kHz, mono  
- **MIME Type**: `"audio/pcm;rate=16000"` for input
- **Encoding**: Base64 for WebSocket transmission

## Message Structure

### Incoming Messages
```javascript
{
    serverContent: {
        inputTranscription: { text: "user speech transcription" },
        outputTranscription: { text: "AI response transcription" },
        modelTurn: {
            parts: [{
                inlineData: {
                    data: "base64_encoded_audio", 
                    mimeType: "audio/pcm;rate=24000"
                }
            }]
        },
        turnComplete: true,
        interrupted: false
    },
    usageMetadata: {
        totalTokenCount: 150,
        responseTokensDetails: [...]
    }
}
```

### Outgoing Messages  
```javascript
// Send audio
await session.send_realtime_input({
    audio: {
        data: base64AudioData,
        mimeType: "audio/pcm;rate=16000"
    }
});

// Send text
await session.send_client_content({
    turns: [{ role: "user", parts: [{ text: "Hello" }] }],
    turnComplete: true
});
```

## Models Available

1. **`gemini-2.5-flash-native-audio-preview-09-2025`** (Recommended)
   - Native audio processing
   - Thinking capabilities  
   - Affective dialog
   - Context: 128k tokens
   
2. **`gemini-2.0-flash-live-001`** 
   - Live API optimized
   - Lower latency
   - Context: 32k tokens

## Limitations

- Audio sessions: 15 minutes max
- Audio+Video sessions: 2 minutes max
- Only one response modality per session (AUDIO or TEXT, not both)
- Context window: 32k-128k tokens depending on model
- Client authentication: Use ephemeral tokens for production

## Official Documentation Links

- Live API Guide: https://ai.google.dev/gemini-api/docs/live-guide
- Voice Options: https://ai.google.dev/gemini-api/docs/speech-generation#voices
- API Reference: https://ai.google.dev/api/live