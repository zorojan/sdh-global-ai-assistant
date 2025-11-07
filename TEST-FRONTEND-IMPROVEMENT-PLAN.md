# Test Frontend Improvement Plan

## Analysis of Current Issues

### 1. Duplicate Voice/Language Settings
**Current Problems:**
- Agent has: `voice`, `language`, `voice_language`, `voice_characteristics`
- Global settings has: `gemini_default_voice`, `gemini_default_language`, `gemini_tts_model`
- Duplicated fields cause confusion and inconsistency

**Current Usage:**
```tsx
// Agent fields (from database)
agent.voice          // e.g., "Aoede"
agent.language       // e.g., "hy-AM"
agent.voice_language // e.g., "hy-AM" (duplicate!)
agent.voice_characteristics // TTS behavior description

// Global settings (from diagnostics)
diagnostics.gemini_default_voice     // e.g., "Kore" 
diagnostics.gemini_default_language  // e.g., "hy-AM"
diagnostics.gemini_tts_model         // e.g., "gemini-2.5-flash-tts"
```

### 2. Message Display Issues
**Problem:** Chat container shows both user input and AI response, creating duplication
**Location:** Test frontend chat display logic

### 3. Frontend Implementation Mode Issues
**Problem:** Many `serverContent` messages but no audio transcription in UI
**Symptoms:** Session opens, receives audio data, but no visible response

### 4. SDK Client Audio Format Error
**Problem:** `Invalid value at realtime_input.media_chunks[0]` - incorrect audio data structure
**Root Cause:** MediaRecorder data not properly formatted for Gemini Live API

## Implementation Plan

### Phase 1: Voice/Language Settings Consolidation

#### Step 1.1: Create unified voice configuration system
```tsx
interface VoiceConfig {
  // Primary voice setting (agent-specific or fallback to global)
  voice: string;           // "Aoede", "Kore", etc.
  
  // Language setting (agent-specific or fallback to global)  
  language: string;        // "hy-AM", "en-US", etc.
  
  // TTS model (from global settings only)
  ttsModel: string;        // "gemini-2.5-flash-tts", etc.
  
  // Voice characteristics (agent-specific)
  characteristics?: string; // TTS behavior description
}
```

#### Step 1.2: Update agent resolution logic
```tsx
const computeVoiceConfig = (agent: Agent, diagnostics: DiagnosticsData): VoiceConfig => {
  return {
    voice: agent.voice || diagnostics.gemini_default_voice || 'Kore',
    language: agent.language || diagnostics.gemini_default_language || 'hy-AM', 
    ttsModel: diagnostics.gemini_tts_model || 'gemini-2.5-flash-tts',
    characteristics: agent.voice_characteristics
  };
}
```

#### Step 1.3: Remove duplicate fields
- Remove `agent.voice_language` (use `agent.language` instead)
- Merge `gemini_default_voice` and `gemini_default_language` into agent fallbacks
- Keep `gemini_tts_model` as global-only setting

### Phase 2: Fix Chat Container Display

#### Step 2.1: Update message filtering
```tsx
// Only show AI responses, not user input echo
const displayMessages = messages.filter(msg => msg.sender === 'ai');
```

#### Step 2.2: Separate user input from AI response display
- User input: shown in input field only
- AI response: shown in chat container
- Remove duplicate message display

### Phase 3: Debug Frontend Implementation Mode

#### Step 3.1: Investigate serverContent message handling
```tsx
// Add better logging for serverContent messages
const handleServerContent = (message: any) => {
  if (message.serverContent) {
    console.log('📨 Server content type:', message.serverContent.type);
    console.log('📨 Server content data:', message.serverContent);
    
    // Check if it contains actual transcription or audio
    if (message.serverContent.modelTurn) {
      // Handle model response
    } else if (message.serverContent.interrupted) {
      // Handle interruption
    }
  }
};
```

#### Step 3.2: Fix audio response extraction
- Verify `inlineData` audio extraction
- Check audio playback in browser
- Ensure transcription display

### Phase 4: Fix SDK Client Audio Format

#### Step 4.1: Correct audio data structure
```tsx
// Current (incorrect):
session.sendRealtimeInput({
  mediaChunks: [arrayBuffer] // Wrong format
});

// Correct format:
session.sendRealtimeInput({
  mediaChunks: [{
    data: base64String,      // Base64 encoded audio
    mimeType: 'audio/pcm'    // Correct MIME type
  }]
});
```

#### Step 4.2: Fix MediaRecorder integration
- Convert ArrayBuffer to base64
- Set correct MIME type
- Ensure proper chunk timing

### Phase 5: Add Debug UI Panel

#### Step 5.1: Create debug overlay component
```tsx
const DebugPanel = ({ logs, rawMessages, usageStats }) => (
  <div className="debug-overlay">
    <div className="debug-tabs">
      <Tab>Logs</Tab>
      <Tab>Raw Messages</Tab>
      <Tab>Usage Stats</Tab>
    </div>
    {/* Content panels */}
  </div>
);
```

## File Changes Required

### 1. Database Schema Updates
- `backend/src/database/init.ts`: Remove duplicate defaults
- Remove `gemini_default_voice`, `gemini_default_language` from settings
- Keep `gemini_tts_model` as global setting

### 2. API Updates  
- `backend/src/routes/agents.ts`: Update agent resolution logic
- Use agent voice/language with global fallbacks

### 3. Frontend Updates
- `test-frontend/src/App.tsx`: Update voice config computation
- `test-frontend/src/gemini-live-client-sdk.ts`: Fix audio format
- `test-frontend/src/gemini-live-client-frontend.ts`: Debug serverContent

### 4. Admin Panel Updates
- `admin-panel/src/components/SettingsTab.tsx`: Remove duplicate voice/language fields
- Move voice/language selection to agent management only

## Priority Order

1. **High Priority**: Fix SDK Client audio format (blocking audio)
2. **High Priority**: Consolidate voice/language settings (reduce confusion) 
3. **Medium Priority**: Fix chat message display (UX improvement)
4. **Medium Priority**: Debug Frontend Implementation mode (diagnostics)
5. **Low Priority**: Add debug UI panel (developer tool)

## Testing Plan

### After Each Phase:
1. Test agent voice selection in admin panel
2. Test voice chat with different agents  
3. Verify no duplicate language settings
4. Check audio format compliance
5. Validate message display behavior

### Integration Test:
1. Select Armenian agent (FSM Helper)
2. Start voice chat with Gemini Live
3. Verify correct voice (from agent settings)
4. Verify correct language (hy-AM from agent)
5. Verify correct TTS model (from global settings)
6. Check audio input/output works correctly