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
import BasicFace from './demo/basic-face/BasicFace';

type VoiceProvider = 'gemini' | 'openai';

// Language instructions for different locales
function getLanguageInstructions(language?: string): string {
  switch (language) {
    case 'hy-AM':
      return `
CRITICAL - ARMENIAN LANGUAGE INSTRUCTIONS:
- You MUST speak ONLY in Eastern Armenian (hy-AM) language
- NEVER use English words or phrases in your responses
- Use proper Armenian grammar and pronunciation
- Respond naturally as a native Armenian speaker
- Example: Instead of "hello" say "բարև" or "բարև ձեզ"
- Use Armenian punctuation: ։ (verjaket) and ՝ (but)

ԿԱՐԵՎՈՐ - ՀԱՅԵՐԵՆ ԼԵԶՎԱԿԱՆ ՀՐԱՀԱՆԳՆԵՐ:
- Դուք ՊԵՏՔ Է խոսեք ՄԻԱՅՆ արևելահայերենով
- ԵՐԲԵՔ մի օգտագործեք անգլերեն բառեր կամ արտահայտություններ
- Օգտագործեք ճիշտ հայերեն քերականություն և արտասանություն
- Պատասխանեք բնականորեն որպես մայրենի հայ խոսող`;
    case 'ru-RU':
      return `
КРИТИЧНО - РУССКИЕ ЯЗЫКОВЫЕ ИНСТРУКЦИИ:
- Вы ДОЛЖНЫ говорить ТОЛЬКО на русском языке
- НИКОГДА не используйте английские слова в ответах
- Используйте правильную русскую грамматику и произношение
- Отвечайте естественно как носитель русского языка`;
    case 'en-US':
    default:
      return `
LANGUAGE INSTRUCTIONS:
- Speak clearly in English
- Use natural English grammar and pronunciation`;
  }
}

// Animated Face Component for OpenAI similar to Gemini's BasicFace
const AnimatedOpenAIFace: React.FC<{ volume: number; isActive: boolean }> = ({ volume, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className="animated-face-container">
      <canvas 
        ref={canvasRef}
        width={256} 
        height={256}
        className="animated-face-canvas"
        style={{
          background: 'transparent',
          borderRadius: '50%',
        }}
      />
      <BasicFace 
        canvasRef={canvasRef}
        isActive={isActive}
        color="#00a67e"
        radius={128}
      />
    </div>
  );
};

interface EnhancedVoiceChatProps {
  agent: any;
  geminiApiKey: string;
  apiUrl?: string;
  initialProvider?: 'gemini' | 'openai';
  allowProviderSelection?: boolean; // true для hybrid режима
  showAnimatedFace?: boolean; // показывать анимированное лицо для OpenAI
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
              text: `${agent.personality || 'You are a helpful AI assistant.'}\n\nPLEASE KEEP RESPONSES VERY SHORT AND CONVERSATIONAL. This is a voice chat, so speak naturally and briefly like in a real conversation.\n\n${getLanguageInstructions(agent.language || agent.voiceLanguage)}`
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

// Simple Face Component for OpenAI (no LiveAPI dependency)
const SimpleFaceWidget: React.FC<{ 
  radius?: number; 
  color?: string; 
  isActive?: boolean; 
}> = ({ radius = 80, color = "#00a67e", isActive = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = radius * 2;
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw face circle
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 10, 0, 2 * Math.PI);
    ctx.fillStyle = isActive ? color : '#e0e0e0';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw eyes
    const eyeY = radius - 20;
    const eyeRadius = isActive ? 8 : 6;
    
    // Left eye
    ctx.beginPath();
    ctx.arc(radius - 25, eyeY, eyeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();

    // Right eye
    ctx.beginPath();
    ctx.arc(radius + 25, eyeY, eyeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();

    // Draw mouth
    const mouthY = radius + 15;
    const mouthWidth = isActive ? 40 : 20;
    
    ctx.beginPath();
    ctx.arc(radius, mouthY, mouthWidth / 2, 0, Math.PI);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.stroke();

  }, [radius, color, isActive]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
};

// OpenAI Realtime Chat Implementation
const OpenAIRealtimeChat: React.FC<{ agent: any; showAnimatedFace?: boolean }> = ({ agent, showAnimatedFace = false }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  
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
        voice: agent.voice || 'alloy',
        temperature: 0.7,
        maxResponseOutputTokens: 4096,
        systemMessage: `${agent.personality || 'You are a helpful AI assistant.'}\n\nPLEASE KEEP RESPONSES VERY SHORT AND CONVERSATIONAL. This is a voice chat, so speak naturally and briefly like in a real conversation.\n\n${getLanguageInstructions(agent.language || agent.voiceLanguage)}`,
        agentId: agent.id
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
        {showAnimatedFace ? (
          <AnimatedOpenAIFace 
            volume={volume}
            isActive={connected && volume > 0}
          />
        ) : (
          <SimpleFaceWidget
            radius={80} 
            color="#00a67e"
            isActive={connected && volume > 0}
          />
        )}
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
  showAnimatedFace?: boolean;
}> = ({ agent, voiceProvider, onProviderChange, allowProviderSelection, showAnimatedFace = false }) => {
  
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
          <OpenAIRealtimeChat agent={agent} showAnimatedFace={showAnimatedFace} />
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
  allowProviderSelection = false,
  showAnimatedFace = false
}) => {
  const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>(initialProvider);

  // Sync with initialProvider changes
  useEffect(() => {
    setVoiceProvider(initialProvider);
  }, [initialProvider]);

  console.log('🎤 EnhancedVoiceChatWidget: Provider:', voiceProvider, 'AllowSelection:', allowProviderSelection, 'InitialProvider:', initialProvider);
  
  return (
    <div className="provider-wrapper">
      {voiceProvider === 'gemini' ? (
        <LiveAPIProviderWidget apiKey={geminiApiKey}>
          <EnhancedVoiceChatInner 
            agent={agent} 
            voiceProvider={voiceProvider}
            onProviderChange={setVoiceProvider}
            allowProviderSelection={allowProviderSelection}
            showAnimatedFace={showAnimatedFace}
          />
        </LiveAPIProviderWidget>
      ) : (
        <OpenAIRealtimeProvider apiUrl={apiUrl}>
          <EnhancedVoiceChatInner 
            agent={agent} 
            voiceProvider={voiceProvider}
            onProviderChange={setVoiceProvider}
            allowProviderSelection={allowProviderSelection}
            showAnimatedFace={showAnimatedFace}
          />
        </OpenAIRealtimeProvider>
      )}
    </div>
  );
};

// Backward compatibility export
export { EnhancedVoiceChatWidget as VoiceChatWidget };