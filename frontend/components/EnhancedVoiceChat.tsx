/**
 * Enhanced Voice Chat Widget with Provider Selection
 * Supports both Gemini Live API and OpenAI Realtime API
 */
import React, { useState, useEffect, useRef } from 'react';
import { Modality } from '@google/genai';
import { AudioRecorder } from '../lib/audio-recorder';
import { LiveAPIProviderWidget, useLiveAPIContextWidget } from '../contexts/LiveAPIContextWidget';
import { OpenAIRealtimeProvider, useOpenAIRealtimeContext } from '../contexts/OpenAIRealtimeContext';
import BasicFaceWidget from './demo/basic-face/BasicFaceWidget';

type VoiceProvider = 'gemini' | 'openai';

interface EnhancedVoiceChatProps {
  agent: any;
  geminiApiKey: string;
  apiUrl?: string;
  initialProvider?: 'gemini' | 'openai';
  allowProviderSelection?: boolean; // true для hybrid режима
}

// Provider Selection Component
const ProviderSelector: React.FC<{
  currentProvider: VoiceProvider;
  onProviderChange: (provider: VoiceProvider) => void;
  disabled?: boolean;
}> = ({ currentProvider, onProviderChange, disabled = false }) => {
  return (
    <div className="provider-selection">
      <h5>🎙️ Voice Provider:</h5>
      <div className="provider-buttons">
        <button
          className={`provider-button ${currentProvider === 'gemini' ? 'active' : ''}`}
          onClick={() => onProviderChange('gemini')}
          disabled={disabled}
        >
          <div className="provider-icon">🤖</div>
          <div className="provider-info">
            <strong>Gemini Live</strong>
            <span>Natural conversation</span>
          </div>
        </button>
        
        <button
          className={`provider-button ${currentProvider === 'openai' ? 'active' : ''}`}
          onClick={() => onProviderChange('openai')}
          disabled={disabled}
        >
          <div className="provider-icon">⚡</div>
          <div className="provider-info">
            <strong>OpenAI Realtime</strong>
            <span>Low latency chat</span>
          </div>
        </button>
      </div>
    </div>
  );
};

// Gemini Voice Chat Implementation
const GeminiVoiceChat: React.FC<{ agent: any }> = ({ agent }) => {
  const [muted, setMuted] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [audioRecorder] = useState(() => new AudioRecorder());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const {
    client,
    connected,
    connect,
    disconnect,
    setConfig,
    volume,
    lastError: apiError
  } = useLiveAPIContextWidget();

  useEffect(() => {
    if (agent && !connected) {
      console.log('🎤 Gemini Voice: Setting up voice config for agent:', agent.name);
      
      const voiceConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: agent.voice || 'Orus' },
          },
        },
        systemInstruction: {
          parts: [
            {
              text: `${agent.personality || 'You are a helpful AI assistant.'}\n\nPLEASE KEEP RESPONSES VERY SHORT AND CONVERSATIONAL. This is a voice chat, so speak naturally and briefly like in a real conversation.`
            }
          ]
        }
      };
      
      setConfig(voiceConfig);
    }
  }, [agent, connected, setConfig]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };
    
    if (connected && !muted && audioRecorder) {
      console.log('🎤 Gemini Voice: Starting audio recording');
      audioRecorder.on('data', onData).start();
    } else {
      console.log('🎤 Gemini Voice: Stopping audio recording');
      audioRecorder.stop();
    }
    
    return () => {
      audioRecorder.off('data', onData);
    };
  }, [connected, client, muted, audioRecorder]);

  const handleVoiceToggle = async () => {
    try {
      if (connected && isListening) {
        console.log('🔇 Gemini Voice: Stopping voice chat');
        setIsListening(false);
        setMuted(true);
        await disconnect();
      } else if (!connected) {
        console.log('🎤 Gemini Voice: Starting voice chat');
        setIsConnecting(true);
        setIsListening(true);
        await connect();
        setTimeout(() => {
          setMuted(false);
          console.log('🎤 Gemini Voice: Voice chat started - ready to listen');
        }, 1000);
        setIsConnecting(false);
      }
    } catch (error) {
      console.error('❌ Gemini Voice: Voice error:', error);
      setIsConnecting(false);
      setIsListening(false);
      setLastError('Connection failed. Please try again.');
    }
  };

  return (
    <>
      {lastError && (
        <div className="voice-error">
          <p>⚠️ {lastError}</p>
        </div>
      )}
      
      <div className="voice-face-container">
        <BasicFaceWidget
          canvasRef={canvasRef}
          radius={80} 
          color="#4285f4"
          isActive={connected && volume > 0}
        />
      </div>
      
      <div className="voice-controls">
        <button
          className={`voice-button gemini ${isListening ? 'listening' : ''} ${isConnecting ? 'connecting' : ''}`}
          onClick={handleVoiceToggle}
          disabled={isConnecting}
        >
          {isConnecting ? (
            '⏳'
          ) : connected && isListening ? (
            '🔇'
          ) : (
            '🎤'
          )}
        </button>
        <div className="voice-status">
          {isConnecting ? (
            'Connecting to Gemini...'
          ) : connected && isListening ? (
            'Listening... Click to stop'
          ) : (
            'Click to start Gemini voice chat'
          )}
        </div>
      </div>
      
      {volume > 0 && (
        <div className="volume-indicator">
          <div 
            className="volume-bar gemini" 
            style={{ width: `${Math.min(volume * 100, 100)}%` }}
          />
        </div>
      )}
    </>
  );
};

// OpenAI Realtime Chat Implementation
const OpenAIRealtimeChat: React.FC<{ agent: any }> = ({ agent }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const {
    client,
    connected,
    connecting,
    connect,
    disconnect,
    setConfig,
    volume,
    lastError: apiError
  } = useOpenAIRealtimeContext();

  useEffect(() => {
    if (agent) {
      console.log('🎤 OpenAI Realtime: Setting up config for agent:', agent.name);
      
      const config = {
        model: 'gpt-4o-realtime-preview',
        voice: 'nova',
        temperature: 0.7,
        maxResponseOutputTokens: 4096,
        systemMessage: `${agent.personality || 'You are a helpful AI assistant.'}\n\nPLEASE KEEP RESPONSES VERY SHORT AND CONVERSATIONAL. This is a voice chat, so speak naturally and briefly like in a real conversation.`
      };
      
      setConfig(config);
    }
  }, [agent, setConfig]);

  const handleVoiceToggle = async () => {
    try {
      if (connected && isListening) {
        console.log('🔇 OpenAI Realtime: Stopping voice chat');
        setIsListening(false);
        await disconnect();
      } else if (!connected && !connecting) {
        console.log('🎤 OpenAI Realtime: Starting voice chat');
        setIsListening(true);
        await connect();
        console.log('🎤 OpenAI Realtime: Voice chat started - ready to listen');
      }
    } catch (error) {
      console.error('❌ OpenAI Realtime: Voice error:', error);
      setIsListening(false);
      setLastError('Connection failed. Please try again.');
    }
  };

  return (
    <>
      {(lastError || apiError) && (
        <div className="voice-error">
          <p>⚠️ {lastError || apiError}</p>
        </div>
      )}
      
      <div className="voice-face-container">
        <BasicFaceWidget
          canvasRef={canvasRef}
          radius={80} 
          color="#00a67e"
          isActive={connected && volume > 0}
        />
      </div>
      
      <div className="voice-controls">
        <button
          className={`voice-button openai ${isListening ? 'listening' : ''} ${connecting ? 'connecting' : ''}`}
          onClick={handleVoiceToggle}
          disabled={connecting}
        >
          {connecting ? (
            '⏳'
          ) : connected && isListening ? (
            '🔇'
          ) : (
            '⚡'
          )}
        </button>
        <div className="voice-status">
          {connecting ? (
            'Connecting to OpenAI...'
          ) : connected && isListening ? (
            'Listening... Click to stop'
          ) : (
            'Click to start OpenAI voice chat'
          )}
        </div>
      </div>
      
      {volume > 0 && (
        <div className="volume-indicator">
          <div 
            className="volume-bar openai" 
            style={{ width: `${Math.min(volume * 100, 100)}%` }}
          />
        </div>
      )}
    </>
  );
};

// Main Enhanced Voice Chat Component
const EnhancedVoiceChatInner: React.FC<{ 
  agent: any; 
  voiceProvider: VoiceProvider; 
  onProviderChange: (provider: VoiceProvider) => void;
  allowProviderSelection: boolean;
}> = ({ agent, voiceProvider, onProviderChange, allowProviderSelection }) => {
  
  return (
    <div className="enhanced-voice-chat-widget">
      <div className="voice-header">
        <h4>🎤 Voice Chat with {agent?.name || 'AI Assistant'}</h4>
        {allowProviderSelection ? (
          <p>Choose your preferred voice provider and start talking!</p>
        ) : (
          <p>Using {voiceProvider === 'gemini' ? 'Google Gemini' : 'OpenAI'} voice chat</p>
        )}
      </div>
      
      {allowProviderSelection && (
        <ProviderSelector
          currentProvider={voiceProvider}
          onProviderChange={onProviderChange}
        />
      )}
      
      <div className="voice-content">
        {voiceProvider === 'gemini' ? (
          <GeminiVoiceChat agent={agent} />
        ) : (
          <OpenAIRealtimeChat agent={agent} />
        )}
      </div>
    </div>
  );
};

// Enhanced Voice Chat with Multiple Providers
export const EnhancedVoiceChatWidget: React.FC<EnhancedVoiceChatProps> = ({ 
  agent, 
  geminiApiKey, 
  apiUrl = 'http://localhost:3001',
  initialProvider = 'gemini',
  allowProviderSelection = false
}) => {
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>(initialProvider);

  console.log('🎤 EnhancedVoiceChatWidget: Provider:', voiceProvider, 'AllowSelection:', allowProviderSelection);
  
  return (
    <div className="provider-wrapper">
      {voiceProvider === 'gemini' ? (
        <LiveAPIProviderWidget apiKey={geminiApiKey}>
          <EnhancedVoiceChatInner 
            agent={agent} 
            voiceProvider={voiceProvider}
            onProviderChange={setVoiceProvider}
            allowProviderSelection={allowProviderSelection}
          />
        </LiveAPIProviderWidget>
      ) : (
        <OpenAIRealtimeProvider apiUrl={apiUrl}>
          <EnhancedVoiceChatInner 
            agent={agent} 
            voiceProvider={voiceProvider}
            onProviderChange={setVoiceProvider}
            allowProviderSelection={allowProviderSelection}
          />
        </OpenAIRealtimeProvider>
      )}
    </div>
  );
};

// Backward compatibility export
export { EnhancedVoiceChatWidget as VoiceChatWidget };