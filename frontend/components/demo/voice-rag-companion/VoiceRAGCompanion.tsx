/**
 * Voice RAG Companion
 * Интеграция с Voice RAG WebSocket сервером для работы с базой знаний FSM
 */
import { useEffect, useRef, useState } from 'react';
import BasicFace from '../basic-face/BasicFace';
import { useAgent, useUser } from '@/lib/state';

export default function VoiceRAGCompanion() {
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const user = useUser();
  const { current } = useAgent();
  
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>('');
  
  // WebSocket references
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Voice RAG session management
  const createVoiceRAGSession = async () => {
    try {
      console.log('🎙️ Создаем Voice RAG сессию...');
      
      const response = await fetch('http://localhost:3001/api/voice-rag/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: 'd741629c-16e0-4009-9ced-77f406a7e6d0', // FSM
          language: 'hy-AM',
          agentId: current.id
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const sessionData = await response.json();
      console.log('✅ Voice RAG сессия создана:', sessionData);
      
      setSessionId(sessionData.sessionId);
      return sessionData;
      
    } catch (error) {
      console.error('❌ Ошибка создания Voice RAG сессии:', error);
      throw error;
    }
  };

  // WebSocket connection for Voice RAG
  const connectVoiceRAG = async (sessionData: any) => {
    try {
      console.log('🔌 Подключаемся к Voice RAG WebSocket...');
      
      const ws = new WebSocket(sessionData.websocketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ Voice RAG WebSocket подключен');
        setConnected(true);
        
        // Отправляем приветственное сообщение
        ws.send(JSON.stringify({
          type: 'text_message',
          text: 'Բարև ձեզ! Ես FSM-ի AI ասիստենտն եմ:',
          sessionId: sessionData.sessionId
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📥 Voice RAG ответ:', message);
          
          if (message.type === 'rag_response') {
            setLastResponse(message.answer);
            
            // Воспроизводим TTS если есть audio
            if (message.audioUrl) {
              playAudioResponse(message.audioUrl);
            }
          }
        } catch (error) {
          console.error('❌ Ошибка обработки WebSocket сообщения:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ Voice RAG WebSocket ошибка:', error);
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('🔌 Voice RAG WebSocket закрыт');
        setConnected(false);
      };

    } catch (error) {
      console.error('❌ Ошибка подключения Voice RAG WebSocket:', error);
      setConnected(false);
    }
  };

  // Воспроизведение аудио ответа
  const playAudioResponse = async (audioUrl: string) => {
    try {
      const audio = new Audio(audioUrl);
      await audio.play();
    } catch (error) {
      console.error('❌ Ошибка воспроизведения аудио:', error);
    }
  };

  // Инициализация записи звука
  const setupAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      
      audioStreamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: BlobPart[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await sendAudioToVoiceRAG(audioBlob);
        audioChunks.length = 0;
      };
      
      console.log('🎤 Аудио запись настроена');
      
    } catch (error) {
      console.error('❌ Ошибка настройки аудио записи:', error);
    }
  };

  // Отправка аудио в Voice RAG
  const sendAudioToVoiceRAG = async (audioBlob: Blob) => {
    if (!wsRef.current || !sessionId) return;
    
    try {
      // Конвертируем blob в base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      wsRef.current.send(JSON.stringify({
        type: 'voice_message',
        audio: base64Audio,
        format: 'webm',
        sessionId: sessionId
      }));
      
      console.log('🎤 Аудио отправлено в Voice RAG');
      
    } catch (error) {
      console.error('❌ Ошибка отправки аудио:', error);
    }
  };

  // Управление записью
  const startListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      mediaRecorderRef.current.start(1000); // Записываем кусками по 1 секунде
      setIsListening(true);
      console.log('🎤 Начинаем запись...');
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      console.log('🛑 Останавливаем запись...');
    }
  };

  // Инициализация при монтировании компонента
  useEffect(() => {
    const initializeVoiceRAG = async () => {
      try {
        // 1. Создаем сессию
        const sessionData = await createVoiceRAGSession();
        
        // 2. Подключаемся к WebSocket
        await connectVoiceRAG(sessionData);
        
        // 3. Настраиваем аудио запись
        await setupAudioRecording();
        
      } catch (error) {
        console.error('❌ Ошибка инициализации Voice RAG:', error);
      }
    };

    // Инициализируем только если есть текущий агент
    if (current.id && current.id !== 'loading') {
      initializeVoiceRAG();
    }

    // Cleanup при размонтировании
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [current.id]);

  // Управление записью по клавише
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isListening && connected) {
        event.preventDefault();
        startListening();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && isListening) {
        event.preventDefault();
        stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isListening, connected]);

  return (
    <div className="voice-rag-companion">
      {/* Панель статуса Voice RAG */}
      <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded text-xs font-mono z-50 max-w-sm">
        <div className="mb-2 font-bold">🎙️ Voice RAG Status</div>
        <div>Agent: {current.name}</div>
        <div>Connected: {connected ? '✅' : '❌'}</div>
        <div>Session: {sessionId ? '✅' : '❌'}</div>
        <div>Listening: {isListening ? '🎤' : '🔇'}</div>
        {connected && (
          <div className="mt-2 text-yellow-400">
            Press and hold SPACE to talk
          </div>
        )}
      </div>

      {/* Панель последнего ответа */}
      {lastResponse && (
        <div className="fixed bottom-4 left-4 bg-blue-900/80 text-white p-3 rounded text-sm max-w-md z-50">
          <div className="font-bold mb-1">🤖 Voice RAG Response:</div>
          <div className="text-blue-200">{lastResponse}</div>
        </div>
      )}

      {/* Кнопки управления */}
      <div className="fixed bottom-4 right-4 flex gap-2 z-50">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={!connected}
          className={`px-4 py-2 rounded font-bold ${
            isListening 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-400'
          }`}
        >
          {isListening ? '🛑 Stop' : '🎤 Talk'}
        </button>
      </div>

      {/* Лицо агента */}
      <BasicFace
        canvasRef={faceCanvasRef!}
        color={current.bodyColor}
        avatarUrl={current.avatarUrl}
        isActive={connected && isListening}
      />
    </div>
  );
}