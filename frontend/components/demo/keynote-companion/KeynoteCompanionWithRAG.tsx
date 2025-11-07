/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useEffect, useRef, useState } from 'react';
import { Modality } from '@google/genai';

import BasicFace from '../basic-face/BasicFace';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { createSystemInstructions } from '@/lib/prompts';
import { useAgent, useUser } from '@/lib/state';

export default function KeynoteCompanionWithRAG() {
  const { client, connected, setConfig } = useLiveAPIContext();
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const user = useUser();
  const { current } = useAgent();
  const [configLoaded, setConfigLoaded] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [lastRAGCheck, setLastRAGCheck] = useState<string>('');
  // Keep last applied agent id to avoid duplicate reloads
  const lastAgentIdRef = useRef<string | null>(null);

  // RAG Integration Functions
  const checkRAGKnowledge = async (userMessage: string) => {
    try {
      console.log(`🧠 [RAG] Проверяем knowledge base для: "${userMessage}"`);
      
      const response = await fetch('http://localhost:3001/api/rag/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage,
          limit: 3,
          threshold: 0.8,
          language: 'hy-AM',
          company_id: 'd741629c-16e0-4009-9ced-77f406a7e6d0' // FSM
        })
      });

      if (!response.ok) {
        console.log('⚠️ [RAG] RAG API недоступен, используем обычный Gemini');
        return null;
      }

      const ragData = await response.json();
      
      if (ragData.success && ragData.results.length > 0) {
        const bestMatch = ragData.results[0];
        console.log(`✅ [RAG] Найден релевантный контент, similarity: ${bestMatch.similarity}`);
        
        // Если similarity достаточно высокий, генерируем RAG ответ
        if (bestMatch.similarity > 0.8) {
          return await generateRAGResponse(userMessage, ragData.results);
        }
      }
      
      console.log('📝 [RAG] Релевантного контента не найдено, используем Gemini Live');
      return null;
      
    } catch (error) {
      console.error('❌ [RAG] Ошибка проверки knowledge base:', error);
      return null;
    }
  };

  const generateRAGResponse = async (query: string, searchResults: any[]) => {
    try {
      console.log(`🎯 [RAG] Генерируем ответ на основе knowledge base`);
      
      const response = await fetch('http://localhost:3001/api/rag/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          search_results: searchResults,
          language: 'hy-AM',
          company_id: 'd741629c-16e0-4009-9ced-77f406a7e6d0'
        })
      });

      if (!response.ok) {
        return null;
      }

      const ragResponse = await response.json();
      
      if (ragResponse.success) {
        console.log(`✅ [RAG] Сгенерирован ответ на основе ${ragResponse.search_results_count} источников`);
        return ragResponse.answer;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ [RAG] Ошибка генерации RAG ответа:', error);
      return null;
    }
  };

  // Function to fetch Live API configuration from database with RAG integration
  const fetchLiveApiConfig = async () => {
    try {
      console.log(`🎵 [Agent: ${current.name}] Fetching Live API configuration with RAG integration...`);

      const response = await fetch(`http://localhost:3001/api/public/config/live-connection/${current.id}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch Live API config: ${response.status}`);
      }

      const { connectionConfig, agentInfo } = await response.json();
      
      // Модифицируем system instruction для работы с RAG
      const enhancedSystemInstruction = `${connectionConfig.config?.systemInstruction || ''}\n\nВАЖНО: Ты работаешь в составе гибридной системы с RAG (Retrieval Augmented Generation). Иногда ты получишь готовые ответы от системы знаний FSM. В таких случаях используй эту информацию как основу для своего ответа, но адаптируй её под свою личность и стиль общения. Всегда отвечай на армянском языке.`;

      const configWithRAG = {
        ...connectionConfig.config,
        systemInstruction: enhancedSystemInstruction
      };

      console.log(`✅ [Agent: ${current.name}] Live API configuration with RAG loaded:`, {
        model: connectionConfig.model,
        ragEnabled: ragEnabled,
        systemInstructionLength: configWithRAG.systemInstruction.length
      });

      setConfig(configWithRAG);
      setConfigLoaded(true);

    } catch (error) {
      console.error(`❌ [Agent: ${current.name}] Error fetching Live API configuration:`, error);

      // Fallback config with RAG support
      const fallbackConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Orus"
            }
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: `You are FSM Helper, an AI assistant for Financial Services Management. Your tone should be բարյացակամ. You should express ուրախ. ${current.personality}\n\nВАЖНО: Ты работаешь с RAG системой. Используй информацию от knowledge base когда она доступна. Всегда отвечай на армянском языке. Start with a welcome message.`
      };

      setConfig(fallbackConfig);
      setConfigLoaded(true);
    }
  };

  // RAG integration through system instruction enhancement
  const processUserInput = async (userMessage: string) => {
    if (!ragEnabled) return null;
    
    setLastRAGCheck(userMessage);
    
    // Проверяем RAG knowledge base
    const ragResponse = await checkRAGKnowledge(userMessage);
    
    if (ragResponse) {
      console.log('🎯 [RAG] Найден релевантный контент, интегрируем в Gemini Live');
      
      // Отправляем контекст как системное сообщение перед пользовательским
      client.send({
        text: `СИСТЕМА: На основе knowledge base FSM: ${ragResponse}. Используй эту информацию для ответа пользователю, но адаптируй под свой стиль.`
      }, false);
      
      return true;
    }
    
    return false;
  };

  // Load configuration and setup
  useEffect(() => {
    if (!current?.id || current.id === 'loading' || current.id === 'default') {
      return;
    }

    if (lastAgentIdRef.current === current.id) {
      return;
    }

    console.log('🎭 Agent changed with RAG integration - Current agent:', current.name);
    setConfigLoaded(false);
    lastAgentIdRef.current = current.id;
    fetchLiveApiConfig();
  }, [setConfig, current.id, current.name]);

  // Start session
  useEffect(() => {
    if (connected && configLoaded) {
      console.log(`🎤 [Agent: ${current.name}] Starting RAG-enhanced session...`);
      const beginSession = async () => {
        try {
          client.send({
            text: 'Greet the user and introduce yourself as FSM Helper. Mention that you can help with FSM services and general questions.',
          }, true);
          console.log(`✅ [Agent: ${current.name}] RAG-enhanced session started`);
        } catch (error) {
          console.error(`❌ [Agent: ${current.name}] Failed to start session:`, error);
        }
      };
      beginSession();
    }
  }, [client, connected, configLoaded, current.name]);

  return (
    <div className="keynote-companion">
      {/* Enhanced debug info with RAG status */}
      <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded text-xs font-mono z-50 max-w-sm">
        <div className="mb-2 font-bold text-green-400">🧠 Gemini Live + RAG</div>
        <div>Agent: {current.name}</div>
        <div>Connected: {connected ? '✅' : '❌'}</div>
        <div>Config Loaded: {configLoaded ? '✅' : '❌'}</div>
        <div>RAG Enabled: {ragEnabled ? '✅' : '❌'}</div>
        {lastRAGCheck && (
          <div className="mt-2 text-yellow-300">
            <div>Last RAG Check:</div>
            <div className="text-xs opacity-75">"{lastRAGCheck.substring(0, 30)}..."</div>
          </div>
        )}
        <button
          onClick={() => setRagEnabled(!ragEnabled)}
          className={`mt-2 px-2 py-1 rounded text-xs ${
            ragEnabled ? 'bg-green-600' : 'bg-gray-600'
          }`}
        >
          {ragEnabled ? 'RAG ON' : 'RAG OFF'}
        </button>
      </div>

      <BasicFace
        canvasRef={faceCanvasRef!}
        color={current.bodyColor}
        avatarUrl={current.avatarUrl}
        isActive={connected}
      />
    </div>
  );
}