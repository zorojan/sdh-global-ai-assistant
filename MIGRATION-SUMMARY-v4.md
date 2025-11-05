# OpenAI Migration Summary for v4.1.0
## Key Updates for Current Advanced Architecture

### 🎯 Migration Strategy for v4.1.0

The v4.1.0 branch has a sophisticated architecture that we need to preserve while migrating from Gemini to OpenAI:

#### Current Architecture Strengths to Maintain:
- ✅ **Manual Voice Activation**: User-controlled 🎤→🔇 interface (no auto-connect)
- ✅ **Dual Context System**: Separate `LiveAPIContext` and `LiveAPIContextWidget`
- ✅ **Advanced Audio Management**: Volume meters, worklets, 80px face widget
- ✅ **Multi-Agent System**: Specialized AI agents with backend configuration
- ✅ **Clean Separation**: Frontend (5173), Backend (3001), Admin (3000)

---

## 📝 Critical Files to Modify

### 1. **Dependencies (Gradual Migration)**
```json
// frontend/package.json - ADD (don't remove @google/genai yet)
{
  "dependencies": {
    "@google/genai": "^1.4.0",        // Keep for transition
    "openai": "^4.104.0",            // Add OpenAI SDK
    "axios": "^1.6.2",
    // ... existing deps
  }
}
```

### 2. **New OpenAI Client (Parallel Implementation)**
```
frontend/lib/
├── genai-live-client.ts           // Keep existing
└── openai-live-client.ts          // Add new (same interface)
```

### 3. **Hybrid Context System**
```
frontend/contexts/
├── LiveAPIContext.tsx             // Keep existing Gemini
├── LiveAPIContextWidget.tsx       // Keep existing Gemini  
├── OpenAILiveContext.tsx          // Add OpenAI version
└── OpenAILiveContextWidget.tsx    // Add OpenAI widget version
```

### 4. **Parallel Hooks**
```
frontend/hooks/media/
├── use-live-api.ts                // Keep existing Gemini
├── use-live-api-widget.ts         // Keep existing Gemini
├── use-openai-live-api.ts         // Add OpenAI version
└── use-openai-live-api-widget.ts  // Add OpenAI widget version
```

---

## 🚀 Implementation Steps

### Phase 1: Setup (Non-breaking)
1. **Add OpenAI SDK**: `cd frontend && npm install openai`
2. **Create OpenAI Client**: New `openai-live-client.ts` with same interface as `genai-live-client.ts`
3. **Backend Enhancement**: Add OpenAI settings to existing database schema
4. **Admin Panel**: Add OpenAI configuration alongside existing Gemini settings

### Phase 2: Parallel Implementation
1. **Create OpenAI Contexts**: Mirror existing `LiveAPIContext` structure
2. **Create OpenAI Hooks**: Mirror existing `use-live-api` functionality  
3. **Add Migration Toggle**: Backend setting to switch between Gemini/OpenAI/Hybrid
4. **Enhance Agent System**: Add voice/language selection per agent

### Phase 3: Armenian Language Optimization
1. **Language Detection**: Automatic Armenian text detection in TTS
2. **Voice Instructions**: Armenian pronunciation guidelines for OpenAI TTS
3. **STT Configuration**: Armenian-optimized speech-to-text settings
4. **UI Enhancements**: Language/voice selection in admin panel

### Phase 4: Testing & Gradual Rollout
1. **A/B Testing**: Compare Gemini vs OpenAI in same interface
2. **Voice Quality**: Test Armenian pronunciation and recognition
3. **Performance**: Compare latency and audio quality
4. **User Experience**: Ensure manual activation and volume indicators work

### Phase 5: Full Migration
1. **Default to OpenAI**: Change default from Gemini to OpenAI
2. **Remove Gemini**: After thorough testing, remove @google/genai
3. **Documentation**: Update all docs for OpenAI implementation
4. **Cleanup**: Remove unused Gemini files and imports

---

## 🇦🇲 Armenian Language Features

### Enhanced TTS with Voice Instructions
```typescript
const armenianInstructions = `
Pronounce Armenian text with proper Armenian phonetics:
- Handle Armenian alphabet (Ա-Ֆ) with correct pronunciation
- Maintain natural Armenian intonation patterns  
- Proper stress on Armenian words and names
- Conversational flow for mixed Armenian-English text
`;

// Usage in OpenAI TTS
const speech = await openai.audio.speech.create({
  model: 'gpt-4o-mini-tts',
  input: 'Բարև ձեզ, ինչպես եք?',
  voice: 'nova',
  instructions: armenianInstructions,
  speed: 0.9 // Slightly slower for clarity
});
```

### Optimized STT Configuration
```typescript
const armenianSTTConfig = {
  type: 'transcription_session.update',
  input_audio_format: 'pcm16',
  input_audio_transcription: {
    model: 'gpt-4o-transcribe',
    language: 'hy', // Armenian language code
    prompt: 'Transcribe Armenian speech with proper Armenian alphabet (Ա-Ֆ). Maintain natural flow and punctuation.'
  },
  turn_detection: {
    type: 'server_vad',
    threshold: 0.5,    // Optimized for Armenian speech patterns
    prefix_padding_ms: 300,
    silence_duration_ms: 500
  }
};
```

---

## ⚡ Compatibility Guarantees

### Same Interface, Better Performance
- **Event System**: Identical to GenAI (`on`, `off`, `emit`)
- **Connection Flow**: Same `connect()`, `disconnect()`, `reset()`
- **Audio Streaming**: Same PCM16 format and volume indicators
- **Manual Activation**: Preserve existing 🎤→🔇 user experience
- **Widget Architecture**: Same 80px face and visual feedback

### Enhanced Backend Integration
```sql
-- Extend existing settings table (non-breaking)
ALTER TABLE settings ADD COLUMN category VARCHAR(50) DEFAULT 'general';
UPDATE settings SET category = 'gemini' WHERE key LIKE '%gemini%';

-- Add OpenAI settings
INSERT INTO settings (key, value, description, category) VALUES 
('openai_api_key', '', 'OpenAI API Key', 'openai'),
('migration_mode', 'gemini', 'API Provider: gemini|openai|hybrid', 'system');
```

---

## 🎯 Success Metrics

### Technical Goals
- [ ] **Zero Downtime**: Gradual migration without service interruption
- [ ] **Same UX**: Preserve existing manual voice activation flow
- [ ] **Better Armenian**: Improved pronunciation and recognition
- [ ] **Performance**: <500ms audio latency, same as current
- [ ] **Compatibility**: All existing features work with OpenAI

### Quality Improvements
- [ ] **Voice Quality**: More natural Armenian pronunciation
- [ ] **Recognition**: Better Armenian speech-to-text accuracy  
- [ ] **Flexibility**: Multiple voice options per agent
- [ ] **Cost Efficiency**: Reduced API costs vs Gemini

---

## 📞 Next Steps

1. **Review Architecture**: Confirm understanding of v4.1.0 structure
2. **Create Parallel Implementation**: Build OpenAI version alongside Gemini
3. **Test Armenian Support**: Validate voice quality and STT accuracy
4. **Gradual Migration**: Implement hybrid mode for safe transition
5. **Full Rollout**: Complete migration after thorough testing

This approach preserves all the advanced features of v4.1.0 while adding superior Armenian language support through OpenAI's instruction-based TTS and enhanced STT capabilities.