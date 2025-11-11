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

export default function KeynoteCompanion() {
  const { client, connected, setConfig } = useLiveAPIContext();
  const faceCanvasRef = useRef<HTMLCanvasElement>(null);
  const user = useUser();
  const { current } = useAgent();
  const [configLoaded, setConfigLoaded] = useState(false);
  // Keep last applied agent id to avoid duplicate reloads
  const lastAgentIdRef = useRef<string | null>(null);
  
  // RAG Integration State
  const [ragEnabled, setRagEnabled] = useState(true);
  const [ragResponseCount, setRAGResponseCount] = useState(0);
  const [ragResponseAlert, setRAGResponseAlert] = useState('');
  const [lastRAGCheck, setLastRAGCheck] = useState('');

  // RAG Integration Functions
  const checkRAGKnowledge = async (userMessage: string): Promise<string | null> => {
    try {
      const response = await fetch('http://localhost:3001/api/rag/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage,
          language: 'hy-AM',
          company_id: 'd741629c-16e0-4009-9ced-77f406a7e6d0',
          search_limit: 2,
          threshold: 0.7
        })
      });

      const ragResult = await response.json();
      if (ragResult.success && ragResult.answer) {
        setRAGResponseCount(prev => prev + 1);
        setRAGResponseAlert('RAG нашел ответ!');
        setTimeout(() => setRAGResponseAlert(''), 3000);
        console.log('✅ RAG: Информация найдена');
        return ragResult.answer;
      }
      return null;
    } catch (error) {
      console.log('❌ RAG: Ошибка поиска');
      return null;
    }
  };

  // Function to fetch Live API configuration from database
  const fetchLiveApiConfig = async () => {
    try {
      console.log(`🎵 [Agent: ${current.name}] Fetching Live API configuration from database...`);

      // 🎯 НОВЫЙ ПОДХОД: Использовать новый endpoint для полной синхронизации
      const response = await fetch(`http://localhost:3001/api/public/config/live-connection/${current.id}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch Live API config: ${response.status}`);
      }

      const { connectionConfig, agentInfo } = await response.json();
      
      console.log(`✅ [Agent: ${current.name}] Live API configuration loaded from database:`, {
        model: connectionConfig.model,
        responseModalities: connectionConfig.config?.responseModalities,
        voiceName: connectionConfig.config?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName,
        inputTranscription: !!connectionConfig.config?.inputAudioTranscription,
        outputTranscription: !!connectionConfig.config?.outputAudioTranscription,
        systemInstructionLength: connectionConfig.config?.systemInstruction?.length || 0,
        systemInstructionPreview: connectionConfig.config?.systemInstruction?.substring(0, 100) + '...',
        agentLanguage: agentInfo.language,
        agentVoiceLanguage: agentInfo.voice_language
      });

      // Add RAG tools to configuration
      const configWithRAG = {
        ...connectionConfig.config,
        tools: ragEnabled ? [
          {
            functionDeclarations: [
              {
                name: 'search_fsm_knowledge',
                description: 'Ищет информацию в базе знаний FSM на армянском языке. Используй эту функцию когда пользователь задает вопросы о FSM услугах, правилах, процедурах.',
                parameters: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Вопрос пользователя для поиска в базе знаний FSM'
                    },
                    language: {
                      type: 'string',
                      description: 'Язык запроса',
                      default: 'hy-AM'
                    }
                  },
                  required: ['query']
                }
              }
            ]
          }
        ] : undefined
      };

      // Set the configuration in the Live API context
      setConfig(configWithRAG);
      setConfigLoaded(true);

      console.log(`🎯 [Agent: ${current.name}] Configuration applied successfully - данные синхронизированы с базой данных!`);

    } catch (error) {
      console.error(`❌ [Agent: ${current.name}] Error fetching Live API configuration:`, error);

      // Fallback to hardcoded config if API fails
      console.log(`🔄 [Agent: ${current.name}] Using fallback hardcoded configuration...`);
      const fallbackConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Orus" // Используем Orus как default из базы данных
            }
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: `You are a conversational AI. Your tone should be բարյացակամ. You should express ուրախ. ${current.personality} Start the conversation immediately with a short welcome message in Armenian without waiting for the user to speak first. All your subsequent responses must be in Armenian.`
      };

      console.log(`⚠️ [Agent: ${current.name}] Applying fallback config:`, {
        responseModalities: fallbackConfig.responseModalities,
        voiceName: fallbackConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName,
        inputTranscription: !!fallbackConfig.inputAudioTranscription,
        outputTranscription: !!fallbackConfig.outputAudioTranscription,
        systemInstructionPreview: fallbackConfig.systemInstruction.substring(0, 100) + '...'
      });

      setConfig(fallbackConfig);
      setConfigLoaded(true);
    }
  };

  // Load Live API configuration on component mount and when agent changes
  // Guard against the placeholder 'loading' agent and duplicate reloads
  useEffect(() => {
    // Skip reload for placeholder agent id or undefined
    if (!current?.id || current.id === 'loading' || current.id === 'default') {
      console.debug(`🔕 Skipping config reload for placeholder agent id='${current?.id}'`);
      return;
    }

    // If agent hasn't changed, skip
    if (lastAgentIdRef.current === current.id) {
      console.debug(`🔕 Agent '${current.name}' (${current.id}) already applied — skipping reload`);
      return;
    }

    console.log('🎭 Agent changed - Current agent:', {
      id: current.id,
      name: current.name,
      personality: current.personality,
      voice: current.voice,
      bodyColor: current.bodyColor,
      avatarUrl: current.avatarUrl
    });

    console.log(`🔄 [Agent: ${current.name}] Reloading Live API configuration due to agent change...`);
    setConfigLoaded(false); // Reset config loaded state
    lastAgentIdRef.current = current.id;
    fetchLiveApiConfig();
  }, [setConfig, current.id, current.name]); // Re-fetch config when agent id changes

  // Initiate the session when the Live API connection is established and config is loaded
  useEffect(() => {
    if (connected && configLoaded) {
      console.log(`🎤 [Agent: ${current.name}] Starting session with agent...`);
      const beginSession = async () => {
        try {
          client.send(
            {
              text: 'Greet the user and introduce yourself and your role.',
            },
            true
          );
          console.log(`✅ [Agent: ${current.name}] Session started successfully`);
        } catch (error) {
          console.error(`❌ [Agent: ${current.name}] Failed to start session:`, error);
        }
      };
      beginSession();
    }
  }, [client, connected, configLoaded, current.name]);

  // RAG Tool Call Handler
  useEffect(() => {
    if (!client || !connected || !ragEnabled) return;

    console.log('🔧 RAG: Настраиваем обработчик tool call');

    const handleToolCall = async (toolCall: any) => {
      if (toolCall.name === 'search_fsm_knowledge') {
        const { query, language = 'hy-AM' } = toolCall.args;
        
        console.log(`🔍 RAG: Поиск для "${query}"`);
        setLastRAGCheck(query);
        
        try {
          const ragAnswer = await checkRAGKnowledge(query);
          
          let toolResponse;
          if (ragAnswer) {
            console.log('✅ RAG: Ответ найден');
            toolResponse = {
              functionResponses: [{
                name: 'search_fsm_knowledge',
                response: {
                  success: true,
                  answer: ragAnswer,
                  source: 'FSM Knowledge Base'
                }
              }]
            };
          } else {
            console.log('❌ RAG: Ответ не найден');
            toolResponse = {
              functionResponses: [{
                name: 'search_fsm_knowledge',
                response: {
                  success: false,
                  message: 'Информация не найдена. Обратитесь в FSM по телефону 060-70-11-11.'
                }
              }]
            };
          }
          
          client.sendToolResponse(toolResponse);
          
        } catch (error) {
          console.error('❌ RAG: Ошибка:', error);
          client.sendToolResponse({
            functionResponses: [{
              name: 'search_fsm_knowledge',
              response: {
                success: false,
                error: 'Ошибка поиска. Попробуйте позже.'
              }
            }]
          });
        }
      }
    };

    client.on('toolcall', handleToolCall);

    return () => {
      client.off('toolcall', handleToolCall);
    };
  }, [client, connected, ragEnabled, checkRAGKnowledge]);

  return (
    <div className="keynote-companion">
      {/* Debug info for current configuration */}
      <div className="fixed top-4 right-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50 max-w-xs">
        <div className="mb-2 font-bold text-green-400">🧠 Gemini Live + RAG</div>
        <div>Agent: {current.name}</div>
        <div>Connected: {connected ? '✅' : '❌'}</div>
        <div>Config Loaded: {configLoaded ? '✅' : '❌'}</div>
        <div>RAG: {ragEnabled ? '✅ ON' : '❌ OFF'}</div>
        
        {/* RAG Response Counter */}
        {ragResponseCount > 0 && (
          <div className="mt-2 p-2 bg-green-700/50 border border-green-400 rounded">
            <div className="font-bold text-green-300">🎯 RAG ОТВЕТЫ: {ragResponseCount}</div>
          </div>
        )}

        {/* Active RAG Alert */}
        {ragResponseAlert && (
          <div className="mt-2 p-2 bg-yellow-600/70 border border-yellow-400 rounded animate-pulse">
            <div className="font-bold text-yellow-200">🔔 {ragResponseAlert}</div>
          </div>
        )}

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
        
        {ragResponseCount > 0 && (
          <button
            onClick={() => {
              setRAGResponseCount(0);
              setRAGResponseAlert('');
            }}
            className="mt-1 ml-2 px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700"
          >
            RESET
          </button>
        )}
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
