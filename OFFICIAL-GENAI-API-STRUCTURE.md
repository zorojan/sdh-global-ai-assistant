# Official Google GenAI JavaScript Library - Live API Structure

Based on analysis of the official repository: https://github.com/googleapis/js-genai

## 📋 **Correct Live API Configuration Structure**

### 1. **Connection Parameters**
```typescript
const session = await client.live.connect({
  model: string,                    // Required: Model ID
  callbacks: LiveCallbacks,         // Required: Event handlers  
  config?: LiveConnectConfig        // Optional: Configuration
});
```

### 2. **LiveConnectConfig Interface**
```typescript
interface LiveConnectConfig {
  // Core Configuration
  responseModalities?: Modality[];              // ["AUDIO"] or ["TEXT"] or ["AUDIO", "TEXT"]
  systemInstruction?: ContentUnion;             // System prompt/instructions
  
  // Speech Configuration
  speechConfig?: SpeechConfig;                  // Voice and speech settings
  
  // Audio Transcription
  inputAudioTranscription?: AudioTranscriptionConfig;   // User speech transcription
  outputAudioTranscription?: AudioTranscriptionConfig;  // AI response transcription
  
  // Generation Parameters
  temperature?: number;                         // Randomness control
  topP?: number;                               // Nucleus sampling
  topK?: number;                               // Top-K sampling
  maxOutputTokens?: number;                    // Max response length
  seed?: number;                               // Deterministic responses
  
  // Advanced Features
  thinkingConfig?: ThinkingConfig;             // Thinking capabilities
  enableAffectiveDialog?: boolean;             // Emotion-aware responses
  proactivity?: ProactivityConfig;             // Proactive responses
  
  // Input Configuration  
  realtimeInputConfig?: RealtimeInputConfig;   // VAD and input handling
  contextWindowCompression?: ContextWindowCompressionConfig;
  
  // Tools and Session Management
  tools?: ToolListUnion;                       // Function calling tools
  sessionResumption?: SessionResumptionConfig; // Session persistence
  
  // Media and Performance
  mediaResolution?: MediaResolution;           // Input media quality
  generationConfig?: GenerationConfig;         // (Deprecated - use direct fields)
  
  // HTTP and Control
  httpOptions?: HttpOptions;                   // Request options
  abortSignal?: AbortSignal;                   // Cancellation signal
}
```

### 3. **SpeechConfig Structure**
```typescript
interface SpeechConfig {
  // Single Speaker Configuration
  voiceConfig?: VoiceConfig;
  
  // Multi-Speaker Configuration (TTS only, NOT Live API)
  multiSpeakerVoiceConfig?: MultiSpeakerVoiceConfig; // ❌ NOT supported in Live API
  
  // Language Configuration (Vertex AI only)
  languageCode?: string;  // Only for Vertex AI
}

interface VoiceConfig {
  prebuiltVoiceConfig?: PrebuiltVoiceConfig;
}

interface PrebuiltVoiceConfig {
  voiceName?: string;  // One of 30 available voices
}
```

### 4. **Available Voice Names (30 total)**
```typescript
type VoiceName = 
  | "Zephyr" | "Puck" | "Charon"           // Bright, Upbeat, Informative
  | "Kore" | "Fenrir" | "Leda"             // Firm, Excitable, Youthful  
  | "Orus" | "Aoede" | "Callirrhoe"        // Firm, Breezy, Easy-going
  | "Autonoe" | "Enceladus" | "Iapetus"    // Bright, Breathy, Clear
  | "Umbriel" | "Algieba" | "Despina"      // Easy-going, Smooth, Smooth
  | "Erinome" | "Algenib" | "Rasalgethi"   // Clear, Gravelly, Informative
  | "Laomedeia" | "Achernar" | "Alnilam"   // Upbeat, Soft, Firm
  | "Schedar" | "Gacrux" | "Pulcherrima"   // Even, Mature, Forward
  | "Achird" | "Zubenelgenubi" | "Vindemiatrix"  // Friendly, Casual, Gentle
  | "Sadachbia" | "Sadaltager" | "Sulafat"; // Lively, Knowledgeable, Warm
```

### 5. **Correct Configuration Examples**

#### **Basic Audio Configuration**
```typescript
const config: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO],
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: "Orus"  // Armenian voice
      }
    }
  },
  systemInstruction: "Your system prompt here..."
};
```

#### **Audio + Text with Transcriptions**
```typescript
const config: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO, Modality.TEXT],
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: "Orus"
      }
    }
  },
  inputAudioTranscription: {},   // Enable user speech transcription
  outputAudioTranscription: {}, // Enable AI response transcription
  systemInstruction: "Your system prompt here..."
};
```

#### **Advanced Configuration with Thinking**
```typescript
const config: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO],
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: "Orus"
      }
    }
  },
  thinkingConfig: {
    thinkingBudget: 1024,
    includeThoughts: true
  },
  enableAffectiveDialog: true,
  proactivity: {
    proactiveAudio: true
  },
  temperature: 0.7,
  topP: 0.9,
  maxOutputTokens: 2048,
  systemInstruction: "Your system prompt here..."
};
```

### 6. **Supported Models**
```typescript
// MLDev (ai.google.dev) Models
"gemini-live-2.5-flash-preview"
"gemini-2.5-flash-native-audio-preview-09-2025"

// Vertex AI Models  
"gemini-2.0-flash-live-preview-04-09"
"gemini-2.5-flash-native-audio-preview-09-2025"
```

### 7. **Message Handling**
```typescript
// Incoming Message Structure
interface LiveServerMessage {
  serverContent?: {
    inputTranscription?: { text: string };      // User speech transcription
    outputTranscription?: { text: string };     // AI response transcription
    modelTurn?: {
      parts: Array<{
        text?: string;                           // Text response
        inlineData?: {
          data: string;                          // Base64 audio data
          mimeType: string;                      // "audio/pcm;rate=24000"
        }
      }>
    };
    turnComplete?: boolean;                      // Turn completion flag
    interrupted?: boolean;                       // Interruption flag
  };
  usageMetadata?: {
    totalTokenCount: number;
    responseTokensDetails: Array<{
      modality: string;
      tokenCount: number;
    }>;
  };
}
```

### 8. **Audio Format Requirements**
```typescript
// Input Audio (to API)
{
  data: string;           // Base64 encoded PCM data
  mimeType: "audio/pcm;rate=16000";  // 16kHz input
}

// Output Audio (from API)  
{
  data: string;           // Base64 encoded PCM data
  mimeType: "audio/pcm;rate=24000";  // 24kHz output
}

// Processing Requirements
- Format: Raw PCM, little-endian, 16-bit
- Input: 16kHz sample rate, mono channel
- Output: 24kHz sample rate, mono channel
- Encoding: Base64 for WebSocket transmission
```

### 9. **Key Differences from Our Implementation**

#### **❌ What We Were Doing Wrong:**
1. **Incorrect model names** - Using preview models that might be unstable
2. **Missing transcription setup** - Not enabling input/output transcription properly  
3. **Hardcoded voices** - Using hardcoded fallbacks instead of passed parameters
4. **Wrong audio processing** - MediaRecorder instead of ScriptProcessorNode with PCM

#### **✅ What We Fixed:**
1. **Correct voice parameter passing** - Now uses agent voice settings properly
2. **Proper system instructions** - Language-specific with strong enforcement
3. **PCM audio format** - ScriptProcessorNode with proper PCM encoding
4. **Parameter debugging** - Full request/response logging

### 10. **Testing Configuration**
```typescript
// Test with Armenian agent
const config: LiveConnectConfig = {
  responseModalities: [Modality.AUDIO, Modality.TEXT],
  speechConfig: {
    voiceConfig: {
      prebuiltVoiceConfig: {
        voiceName: "Orus"  // Armenian firm voice
      }
    }
  },
  inputAudioTranscription: {},
  outputAudioTranscription: {},
  systemInstruction: `ԿԱՐԵՎՈՐ: Դուք ՄԻԱՅՆ հայերեն եք խոսում: Արգելված է օգտագործել անգլերեն, ռուսերեն կամ այլ լեզու: 

Դուք հայերեն խոսող օգտակար և բարեկամական զրուցակից արհեստական բանականություն եք: Զրույցը սկսեք հայերեն ողջույնով: Բոլոր պատասխանները ԲԱՑԱՌԱՊԵՍ հայերեն:

ՕՐԻՆԱԿ ողջույն: "Բարև ձեզ! Ինչպե՞ս կարող եմ օգնել:"`
};
```

## 🔗 **Official Documentation Links**
- Repository: https://github.com/googleapis/js-genai
- Live API Guide: https://ai.google.dev/gemini-api/docs/live-guide
- Voice Options: https://ai.google.dev/gemini-api/docs/speech-generation#voices
- API Reference: https://ai.google.dev/api/live
- TypeScript Types: Available in the @google/genai package