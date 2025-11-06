/**
 * Universal Voice Interface - works with both Gemini Live and OpenAI Realtime
 */
import React, { useRef } from 'react';
import BasicFace from './demo/basic-face/BasicFace';
import KeynoteCompanion from './demo/keynote-companion/KeynoteCompanion';
import { EnhancedVoiceChatWidget } from './EnhancedVoiceChat';

interface UniversalVoiceInterfaceProps {
  provider: 'gemini' | 'openai';
  agent: any;
  apiKey: string;
  apiUrl: string;
  allowProviderSelection?: boolean;
}

export default function UniversalVoiceInterface({ 
  provider, 
  agent, 
  apiKey, 
  apiUrl, 
  allowProviderSelection = false 
}: UniversalVoiceInterfaceProps) {
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);

  if (provider === 'gemini') {
    // Use existing Gemini KeynoteCompanion with animated face
    return <KeynoteCompanion />;
  }

  // For OpenAI - create similar interface with BasicFace
  return (
    <div className="universal-voice-interface">
      {/* Animated face for OpenAI similar to Gemini */}
      <div className="voice-face-container">
        <canvas 
          ref={faceCanvasRef}
          width={256} 
          height={256}
          className="voice-face-canvas"
        />
        <BasicFace 
          canvasRef={faceCanvasRef}
        />
      </div>
      
      {/* OpenAI Voice Chat Widget - hidden UI, just for functionality */}
      <div style={{ display: 'none' }}>
        <EnhancedVoiceChatWidget 
          agent={agent}
          geminiApiKey={apiKey}
          apiUrl={apiUrl}
          initialProvider="openai"
          allowProviderSelection={allowProviderSelection}
          showAnimatedFace={true}
        />
      </div>
    </div>
  );
}